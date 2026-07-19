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
import { hasSufficientMemory, loadProjectMemory, summarizeMemoryForPrompt } from "../memory/projectMemory";
import { updateProjectMemory } from "../memory/memoryWriter";
import type { Telemetry } from "../observability/telemetry";

export interface ExplorerOptions {
    config: AgentConfig;
    workspace: string;
    telemetry?: Telemetry;
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
            mode: "explorer",
            config: options.config,
            supervisionMode: false,
            taskState,
            telemetry: options.telemetry
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

/**
 * Variante del Explorer que primero chequea la memoria persistente del
 * proyecto. Si ya hay evidencia suficiente guardada de sesiones anteriores,
 * la reutiliza sin volver a explorar el repositorio desde cero (Tarea 2 de
 * la consigna). Si no hay memoria suficiente, explora normalmente y al
 * terminar actualiza la memoria para la próxima sesión.
 */
export async function runExplorerWithMemory(
    taskState: TaskState,
    options: ExplorerOptions,
    forceReExplore: boolean = false
): Promise<SubagentResult> {
    const memory = loadProjectMemory(options.config);

    if (hasSufficientMemory(memory) && !forceReExplore) {
        const startedAt = new Date().toISOString();
        const summary = summarizeMemoryForPrompt(memory);

        logProgress(
            taskState,
            "Explorer: se encontró memoria persistente suficiente del proyecto. Se reutiliza en vez de re-explorar."
        );

        const result: SubagentResult = {
            subagent: "explorer",
            summary: `(Recuperado de memoria persistente, sin re-explorar el repositorio)\n\n${summary}`,
            sources: [
                {
                    type: "memory",
                    ref: options.config.paths.memory,
                    snippet: summary.slice(0, 300),
                    retrievedAt: new Date().toISOString()
                }
            ],
            filesTouched: [],
            success: true,
            raw: { origin: "memory" },
            startedAt,
            finishedAt: new Date().toISOString()
        };

        recordSubagentResult(taskState, result);
        return result;
    }

    const result = await runExplorer(taskState, options);

    if (result.success) {
        await updateProjectMemory(taskState, result.summary, options.config, options.telemetry);
    }

    return result;
}
