import type { ResponseInputItem } from "openai/resources/responses/responses";
import { runAgentTurn, type ToolCallLogEntry } from "../agent/harness";
import type { AgentConfig } from "../policies/config";
import {
    type SubagentResult,
    type TaskState,
    addObservation,
    logProgress,
    recordSubagentResult,
    summarizeForPrompt
} from "../agent/taskState";
import { repositorySourcesFromToolLog, writtenFilesFromToolLog } from "./toolLog";
import type { Telemetry } from "../observability/telemetry";

export interface ImplementerOptions {
    config: AgentConfig;
    workspace: string;
    supervisionMode?: boolean;
    confirmAction?: (message: string) => Promise<boolean>;
    telemetry?: Telemetry;
}

export async function runImplementer(
    taskState: TaskState,
    options: ImplementerOptions
): Promise<SubagentResult> {
    const startedAt = new Date().toISOString();
    logProgress(taskState, "Implementer: iniciando implementación.");

    const conversation: ResponseInputItem[] = [];
    const prompt = `
Workspace: ${options.workspace}

Implementá el pedido original usando el estado compartido como contexto:
${summarizeForPrompt(taskState)}
    `.trim();

    try {
        const turnResult = await runAgentTurn(prompt, conversation, {
            mode: "implementer",
            config: options.config,
            supervisionMode: options.supervisionMode ?? false,
            confirmAction: options.confirmAction,
            taskState,
            telemetry: options.telemetry
        });
        const sources = repositorySourcesFromToolLog(turnResult.toolCallLog);
        const filesTouched = writtenFilesFromToolLog(turnResult.toolCallLog);
        const blockedActions = computeBlockedActions(turnResult.toolCallLog);
        const blockedByApproval = blockedActions.some((entry) =>
            Boolean((entry.rawOutput as { rejected?: boolean }).rejected)
        );
        const success = blockedActions.length === 0;

        if (!success) {
            addObservation(
                taskState,
                `Implementer: ${blockedActions.length} acción(es) modificadora(s) fueron rechazadas o denegadas.`,
                blockedByApproval ? "warning" : "blocker"
            );
        }
        const result: SubagentResult = {
            subagent: "implementer",
            summary: turnResult.finalText,
            sources,
            filesTouched,
            success,
            raw: {
                iterations: turnResult.iterations,
                blockedActions: blockedActions.map((entry) => entry.outputSummary),
                blockedByApproval
            },
            startedAt,
            finishedAt: new Date().toISOString()
        };

        recordSubagentResult(taskState, result);
        logProgress(
            taskState,
            success
                ? `Implementer: implementación completa. ${filesTouched.length} archivo(s) modificado(s).`
                : "Implementer: implementación finalizada con acciones bloqueadas."
        );
        return result;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addObservation(taskState, `Implementer falló: ${message}`, "blocker");
        const result: SubagentResult = {
            subagent: "implementer",
            summary: `El Implementer no pudo completar la implementación: ${message}`,
            sources: [],
            filesTouched: [],
            success: false,
            startedAt,
            finishedAt: new Date().toISOString()
        };
        recordSubagentResult(taskState, result);
        return result;
    }
}

/**
 * Antes: cualquier write_file/run_command que hubiera fallado ALGUNA VEZ en
 * el historial contaba como "bloqueado", incluso si el agente se dio cuenta
 * solo, corrigió el problema (ej: creó una carpeta faltante) y reintentó
 * con éxito. Eso generaba falsos "failed" para corridas que en realidad
 * terminaron bien.
 *
 * Ahora: solo miramos el ÚLTIMO intento sobre cada path (para write_file) o
 * cada comando (para run_command). Si ese último intento fue denegado,
 * rechazado por el usuario, o falló, ahí sí cuenta como bloqueo real.
 */
function computeBlockedActions(log: ToolCallLogEntry[]): ToolCallLogEntry[] {
    const modifying = log.filter((e) => e.tool === "write_file" || e.tool === "run_command");

    const lastAttemptByTarget = new Map<string, ToolCallLogEntry>();
    for (const entry of modifying) {
        const key = `${entry.tool}:${targetKey(entry)}`;
        lastAttemptByTarget.set(key, entry); // el log está en orden cronológico: la última sobreescribe
    }

    return [...lastAttemptByTarget.values()].filter((entry) => {
        if (entry.denied) return true;
        return entry.tool === "write_file" && isErrorOutput(entry.rawOutput);
    });
}

function targetKey(entry: ToolCallLogEntry): string {
    const args = entry.args as { path?: string; command?: string };
    return args.path ?? args.command ?? JSON.stringify(entry.args);
}

function isErrorOutput(rawOutput: unknown): boolean {
    return typeof rawOutput === "object" && rawOutput !== null && "error" in rawOutput;
}