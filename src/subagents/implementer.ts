import type { ResponseInputItem } from "openai/resources/responses/responses";
import { runAgentTurn } from "../agent/harness";
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

export interface ImplementerOptions {
    config: AgentConfig;
    workspace: string;
    supervisionMode?: boolean;
    confirmAction?: (message: string) => Promise<boolean>;
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
            confirmAction: options.confirmAction
        });
        const sources = repositorySourcesFromToolLog(turnResult.toolCallLog);
        const filesTouched = writtenFilesFromToolLog(turnResult.toolCallLog);
        const blockedActions = turnResult.toolCallLog.filter((entry) => {
            if (entry.tool !== "write_file" && entry.tool !== "run_command") return false;
            if (entry.denied) return true;
            return entry.tool === "write_file" && "error" in (entry.rawOutput as object);
        });
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
