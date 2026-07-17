import type { ResponseInputItem } from "openai/resources/responses/responses";
import { runAgentTurn, ToolCallLogEntry } from "../agent/harness";
import { AgentConfig } from "../policies/config";
import {
    Source,
    SubagentResult,
    TaskState,
    addObservation,
    logProgress,
    recordSubagentResult
} from "../agent/taskState";

const EXPLORER_INSTRUCTIONS = `
Sos el subagente Explorer dentro de un sistema multi-agente de coding.
Tu única responsabilidad es ENTENDER el repositorio, no modificarlo.

Usá list_files y read_file para averiguar:
- estructura general de carpetas
- arquitectura (ej: API REST, capas, dónde viven rutas/modelos/tests)
- dependencias principales (leé package.json si existe)
- convenciones de código que notes (naming, organización de archivos)
- archivos que consideres relevantes para trabajar en el proyecto

No tenés acceso a write_file ni run_command: no podés ni debés intentar modificar nada.
Cuando tengas evidencia suficiente, respondé con un resumen claro y estructurado
(usá secciones: Estructura, Arquitectura, Dependencias, Convenciones, Archivos relevantes).
No inventes nada que no hayas leído con las tools.
`.trim();

const EXPLORER_ALLOWED_TOOLS = ["list_files", "read_file"] as const;

export interface ExplorerOptions {
    config: AgentConfig;
    workspace: string;
}

export async function runExplorer(
    taskState: TaskState,
    options: ExplorerOptions
): Promise<SubagentResult> {
    const startedAt = new Date().toISOString();
    logProgress(taskState, "Explorer: iniciando exploración del repositorio.");

    const conversation: ResponseInputItem[] = [];

    const prompt = `
Explorá el workspace ubicado en: ${options.workspace}
Pedido original del usuario (para darte contexto de qué buscar): "${taskState.originalRequest}"
  `.trim();

    let turnResult;
    try {
        turnResult = await runAgentTurn(prompt, conversation, {
            config: options.config,
            supervisionMode: false,
            instructions: EXPLORER_INSTRUCTIONS,
            allowedTools: [...EXPLORER_ALLOWED_TOOLS]
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addObservation(taskState, `Explorer falló: ${message}`, "blocker");
        const result: SubagentResult = {
            subagent: "explorer",
            summary: `El Explorer no pudo completar la exploración: ${message}`,
            sources: [],
            filesTouched: [],
            success: false,
            startedAt,
            finishedAt: new Date().toISOString()
        };
        recordSubagentResult(taskState, result);
        return result;
    }

    const sources = buildSourcesFromToolCalls(turnResult.toolCallLog);

    const result: SubagentResult = {
        subagent: "explorer",
        summary: turnResult.finalText,
        sources,
        filesTouched: [],
        success: true,
        raw: { iterations: turnResult.iterations },
        startedAt,
        finishedAt: new Date().toISOString()
    };

    recordSubagentResult(taskState, result);
    logProgress(
        taskState,
        `Explorer: exploración completa. ${sources.length} fuente(s) del repositorio consultadas.`
    );

    return result;
}

function buildSourcesFromToolCalls(log: ToolCallLogEntry[]): Source[] {
    return log
        .filter((entry) => (entry.tool === "read_file" || entry.tool === "list_files") && !entry.denied)
        .map((entry) => {
            const args = entry.args as { path?: string };
            return {
                type: "repository" as const,
                ref: args.path ?? "(path desconocido)",
                snippet: entry.outputSummary,
                retrievedAt: new Date().toISOString()
            };
        });
}