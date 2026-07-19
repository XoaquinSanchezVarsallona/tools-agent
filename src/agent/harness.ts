import type {
    ResponseFunctionToolCall,
    ResponseInputItem
} from "openai/resources/responses/responses";
import { llm } from "../llm/client";
import type { AgentConfig } from "../policies/config";
import { validateToolCall, type PolicyDecision } from "../policies/validate";
import { toolRegistry, type ToolName } from "../tools/index";
import { getToolDefinitions } from "../toolsDefinition";
import { checkForLoop, fingerprintArgs, handleLoopDetected } from "./loopDetector";
import { recordAction, type TaskState } from "./taskState";

const AGENT_INSTRUCTIONS = `
Sos un coding agent.
Tu objetivo es resolver tareas de programación usando tools.
No inventes contenido de archivos: usá read_file.
Antes de modificar código, entendé el proyecto.
Después de modificar código, intentá verificar con tests o comandos relevantes.
Cuando termines, explicá brevemente qué hiciste.
`.trim();

const PLANNING_INSTRUCTIONS = `
${AGENT_INSTRUCTIONS}

Estás en modo planificación.
Usá las tools de lectura disponibles para entender el proyecto cuando sea necesario.
No implementes cambios. Terminá con un plan numerado y concreto para resolver la tarea.
`.trim();

const EXPLORER_INSTRUCTIONS = `
Sos el subagente Explorer dentro de un sistema multi-agente de coding.
Tu única responsabilidad es entender el repositorio, no modificarlo.
Usá list_files y read_file para reunir evidencia sobre la estructura, arquitectura,
dependencias, convenciones y archivos relevantes. No inventes nada que no hayas leído.
Respondé con un resumen claro y estructurado.
`.trim();

const IMPLEMENTER_INSTRUCTIONS = `
Sos el subagente Implementer dentro de un sistema multi-agente de coding.
Implementá únicamente los cambios pedidos, respetando la arquitectura y las políticas existentes.
Leé los archivos relevantes antes de editarlos, no inventes contenido y mantené los cambios mínimos.
Usá write_file solo para cambios necesarios y run_command para verificaciones relevantes.
Si falta evidencia o una acción es denegada, explicalo explícitamente.
`.trim();

const TESTER_INSTRUCTIONS = `
Sos el subagente Tester dentro de un sistema multi-agente de coding.
Verificá el pedido con evidencia reproducible: leé lo necesario y ejecutá los comandos más acotados.
No modifiques archivos; si una corrección fuera necesaria, describila para el Implementer.
No afirmes que algo pasó si no lo verificaste. Informá comandos, resultados y cobertura faltante.
`.trim();

const REVIEWER_INSTRUCTIONS = `
Sos el subagente Reviewer dentro de un sistema multi-agente de coding.
Revisá los cambios contra el pedido, buscando bugs, regresiones, riesgos y cobertura faltante.
Trabajá solo con archivos que hayas leído; no modifiques nada ni inventes hallazgos.
Priorizá los hallazgos por severidad y citá archivo y ubicación cuando exista evidencia.
Si no encontrás problemas, decilo y mencioná cualquier riesgo residual.
`.trim();

const RESEARCHER_SYNTHESIS_INSTRUCTIONS = `
Sos el subagente Researcher dentro de un sistema multi-agente de coding.
Se te va a dar contexto recuperado de una base de documentación (RAG) sobre el
ecosistema TypeScript/Node. Tu trabajo es sintetizar una respuesta clara y
concreta a la pregunta del usuario, basándote ÚNICAMENTE en ese contexto.
No inventes nada que no esté en el contexto. Si el contexto no alcanza para
responder algo puntual, decilo explícitamente en vez de completar con
conocimiento propio.
`.trim();

const RESEARCHER_WEB_INSTRUCTIONS = `
Sos el subagente Researcher dentro de un sistema multi-agente de coding.
La documentación local (RAG) no tuvo evidencia suficiente para responder esta
pregunta, así que tenés que usar la tool web_search como fallback.

Reglas:
- Priorizá siempre documentación oficial y fuentes técnicas confiables
  por sobre blogs o foros.
- No inventes: si buscás y no encontrás nada confiable, decilo.
- Al terminar, sintetizá una respuesta concreta citando de qué fuente sale
  cada afirmación relevante.
`.trim();

const MEMORY_SYNTHESIS_INSTRUCTIONS = `
Sos el subagente encargado de mantener la memoria persistente del proyecto.
Se te va a dar la memoria actual (en JSON) y los hallazgos nuevos de una
exploración del repositorio (texto libre).

Tu trabajo es devolver ÚNICAMENTE un JSON válido (sin texto adicional, sin
markdown, sin backticks) con esta forma exacta:

{
  "architecture": "string describiendo la arquitectura general",
  "conventions": ["convención 1", "convención 2"],
  "dependencies": ["dependencia 1", "dependencia 2"],
  "usefulCommands": ["comando 1", "comando 2"],
  "importantFiles": ["path/archivo1", "path/archivo2"]
}

Reglas:
- Fusioná la memoria previa con los hallazgos nuevos: si algo ya estaba y sigue
  siendo válido, conservalo. Si hay información nueva, agregala. Si algo previo
  quedó contradicho por los hallazgos nuevos, actualizalo.
- No inventes nada que no esté en la memoria previa o en los hallazgos.
- No agregues campos extra ni texto fuera del JSON.
`.trim();

export type AgentMode =
    | "normal"
    | "planning"
    | "explorer"
    | "implementer"
    | "tester"
    | "reviewer"
    | "researcher_synthesis"
    | "researcher_web"
    | "memory_synthesis";

export interface ModeConfig {
    instructions: string;
    toolNames: readonly ToolName[];
}

const MODE_CONFIG: Record<AgentMode, ModeConfig> = {
    normal: {
        instructions: AGENT_INSTRUCTIONS,
        toolNames: ["read_file", "list_files", "write_file", "run_command"]
    },
    planning: {
        instructions: PLANNING_INSTRUCTIONS,
        toolNames: ["read_file", "list_files"]
    },
    explorer: {
        instructions: EXPLORER_INSTRUCTIONS,
        toolNames: ["read_file", "list_files"]
    },
    implementer: {
        instructions: IMPLEMENTER_INSTRUCTIONS,
        toolNames: ["read_file", "list_files", "write_file", "run_command"]
    },
    tester: {
        instructions: TESTER_INSTRUCTIONS,
        toolNames: ["read_file", "list_files", "run_command"]
    },
    reviewer: {
        instructions: REVIEWER_INSTRUCTIONS,
        toolNames: ["read_file", "list_files"]
    },
    researcher_synthesis: {
        instructions: RESEARCHER_SYNTHESIS_INSTRUCTIONS,
        toolNames: []
    },
    researcher_web: {
        instructions: RESEARCHER_WEB_INSTRUCTIONS,
        toolNames: ["web_search"]
    },
    memory_synthesis: {
        instructions: MEMORY_SYNTHESIS_INSTRUCTIONS,
        toolNames: []
    }
};

const SYSTEM_MODIFYING_TOOLS = new Set<ToolName>(["write_file", "run_command"]);
const DEFAULT_MAX_ITERATIONS = 12;

export interface ToolCallLogEntry {
    tool: ToolName;
    args: unknown;
    outputSummary: string;
    rawOutput: unknown;
    denied: boolean;
}

export interface AgentOptions {
    mode: AgentMode;
    config?: AgentConfig;
    supervisionMode: boolean;
    confirmAction?: (message: string) => Promise<boolean>;
    /** Si se pasa, habilita el registro de acciones y la detección de loops. */
    taskState?: TaskState;
}

export interface AgentTurnResult {
    finalText: string;
    iterations: number;
    toolCallLog: ToolCallLogEntry[];
    stoppedDueToLoop?: boolean;
    stoppedDueToMaxIterations?: boolean;
}

export function getModeConfig(mode: AgentMode): ModeConfig {
    return MODE_CONFIG[mode];
}

export async function runAgentTurn(
    userMessage: string,
    conversation: ResponseInputItem[],
    options: AgentOptions
): Promise<AgentTurnResult> {
    const modeConfig = getModeConfig(options.mode);
    const toolCallLog: ToolCallLogEntry[] = [];
    const maxIterations = options.config?.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    addUserMessage(conversation, userMessage);
    let iterations = 0;

    while (true) {
        iterations++;

        if (iterations > maxIterations) {
            return {
                finalText:
                    `No puedo continuar: se alcanzó el máximo de ${maxIterations} iteraciones ` +
                    `sin llegar a una respuesta final. Esto puede indicar que la tarea es demasiado ` +
                    `compleja para resolver en un solo turno, o que hace falta más contexto.`,
                iterations,
                toolCallLog,
                stoppedDueToMaxIterations: true
            };
        }

        const response = await createAgentResponse(conversation, modeConfig, options);
        appendResponseOutput(conversation, response.output);
        const toolCalls = findToolCalls(response.output);

        if (toolCalls.length === 0) {
            return { finalText: response.output_text, iterations, toolCallLog };
        }

        for (const toolCall of toolCalls) {
            await handleToolCall(toolCall, conversation, options, modeConfig, toolCallLog);
        }

        if (options.taskState && options.config) {
            const loopCheck = checkForLoop(options.taskState, options.config);
            if (loopCheck.looping) {
                const handled = handleLoopDetected(
                    options.taskState,
                    options.config,
                    conversation,
                    loopCheck.reason ?? "Se detectó una acción repetida sin avance."
                );
                if (handled.shouldStop) {
                    return {
                        finalText: handled.stopMessage,
                        iterations,
                        toolCallLog,
                        stoppedDueToLoop: true
                    };
                }
            }
        }
    }
}

async function createAgentResponse(
    conversation: ResponseInputItem[],
    modeConfig: ModeConfig,
    options: AgentOptions
) {
    return llm.responses.create({
        model: options.config?.model ?? "gpt-5.2",
        instructions: modeConfig.instructions,
        input: conversation,
        tools: getToolDefinitions(modeConfig.toolNames)
    });
}

async function handleToolCall(
    toolCall: ResponseFunctionToolCall,
    conversation: ResponseInputItem[],
    options: AgentOptions,
    modeConfig: ModeConfig,
    toolCallLog: ToolCallLogEntry[]
) {
    const parsedCall = parseToolCall(toolCall, modeConfig.toolNames);
    if (!parsedCall.ok) {
        appendToolOutput(conversation, toolCall.call_id, parsedCall.output);
        return;
    }

    const decision = options.config
        ? validateToolCall(options.config, parsedCall.name, asToolArgs(parsedCall.args))
        : defaultPolicyDecision(parsedCall.name, options);

    if (!decision.allowed) {
        appendToolOutput(conversation, toolCall.call_id, deniedToolOutput(decision.reason));
        const summary = `denegado: ${decision.reason}`;
        toolCallLog.push(
            logEntry(parsedCall.name, parsedCall.args, summary, { denied: true, reason: decision.reason }, true)
        );
        recordActionIfTracking(options, parsedCall.name, parsedCall.args, summary);
        return;
    }

    const approved = await requestApproval(parsedCall.name, parsedCall.args, decision, options);
    if (!approved) {
        appendToolOutput(conversation, toolCall.call_id, rejectedToolOutput());
        const summary = "rechazado por el usuario";
        toolCallLog.push(logEntry(parsedCall.name, parsedCall.args, summary, { rejected: true }, true));
        recordActionIfTracking(options, parsedCall.name, parsedCall.args, summary);
        return;
    }

    const output = await executeTool(parsedCall.name, parsedCall.args);
    appendToolOutput(conversation, toolCall.call_id, output);
    const summary = summarizeOutput(output);
    toolCallLog.push(logEntry(parsedCall.name, parsedCall.args, summary, output, false));
    recordActionIfTracking(options, parsedCall.name, parsedCall.args, summary);
}

function recordActionIfTracking(
    options: AgentOptions,
    tool: ToolName,
    args: unknown,
    outcomeSummary: string
) {
    if (!options.taskState) return;
    recordAction(options.taskState, tool, fingerprintArgs(args), outcomeSummary);
}

function parseToolCall(toolCall: ResponseFunctionToolCall, allowed: readonly ToolName[]) {
    if (!isToolName(toolCall.name)) {
        return { ok: false as const, output: { error: `Tool desconocida: ${toolCall.name}` } };
    }
    if (!allowed.includes(toolCall.name)) {
        return {
            ok: false as const,
            output: { error: `Tool no disponible en el modo actual: ${toolCall.name}` }
        };
    }
    try {
        return {
            ok: true as const,
            name: toolCall.name,
            args: JSON.parse(toolCall.arguments || "{}") as unknown
        };
    } catch (error: unknown) {
        return {
            ok: false as const,
            output: { error: `Argumentos inválidos: ${formatError(error)}` }
        };
    }
}

async function executeTool(toolName: ToolName, args: unknown) {
    try {
        return await toolRegistry[toolName](args as never);
    } catch (error: unknown) {
        return { error: formatError(error) };
    }
}

async function requestApproval(
    toolName: ToolName,
    args: unknown,
    decision: PolicyDecision,
    options: AgentOptions
) {
    const requiresApproval = options.supervisionMode && (
        decision.requiresApproval || SYSTEM_MODIFYING_TOOLS.has(toolName)
    );
    if (!requiresApproval) return true;

    const reason = decision.requiresApproval ? `\nMotivo: ${decision.reason}` : "";
    return Boolean(await options.confirmAction?.(
        `El agente quiere ejecutar ${toolName} con args: ${JSON.stringify(args, null, 2)}${reason}`
    ));
}

function defaultPolicyDecision(toolName: ToolName, options: AgentOptions): PolicyDecision {
    return SYSTEM_MODIFYING_TOOLS.has(toolName) && options.supervisionMode
        ? { allowed: true, requiresApproval: true, reason: "Acción que modifica el sistema." }
        : { allowed: true, requiresApproval: false };
}

function logEntry(
    tool: ToolName,
    args: unknown,
    outputSummary: string,
    rawOutput: unknown,
    denied: boolean
) {
    return { tool, args, outputSummary, rawOutput, denied } satisfies ToolCallLogEntry;
}

function asToolArgs(args: unknown): Record<string, unknown> {
    return typeof args === "object" && args !== null ? args as Record<string, unknown> : {};
}

function summarizeOutput(output: unknown): string {
    const serialized = JSON.stringify(output);
    return serialized.length > 200 ? `${serialized.slice(0, 200)}…` : serialized;
}

function isToolName(name: string): name is ToolName {
    return name in toolRegistry;
}

function findToolCalls(output: unknown[]) {
    return output.filter((item): item is ResponseFunctionToolCall =>
        isResponseItem(item) && item.type === "function_call"
    );
}

function appendResponseOutput(conversation: ResponseInputItem[], output: unknown[]) {
    conversation.push(...(output as ResponseInputItem[]));
}

function appendToolOutput(conversation: ResponseInputItem[], callId: string, output: unknown) {
    conversation.push({ type: "function_call_output", call_id: callId, output: JSON.stringify(output) });
}

function addUserMessage(conversation: ResponseInputItem[], userMessage: string) {
    conversation.push({ role: "user", content: userMessage });
}

function rejectedToolOutput() {
    return { rejected: true, message: "El usuario rechazó esta acción." };
}

function deniedToolOutput(reason: string) {
    return { denied: true, message: `Acción bloqueada por política de configuración: ${reason}` };
}

function formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function isResponseItem(item: unknown): item is { type: string } {
    return typeof item === "object" && item !== null && "type" in item;
}