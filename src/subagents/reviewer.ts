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
import { repositorySourcesFromToolLog } from "./toolLog";

export interface ReviewerOptions {
    config: AgentConfig;
    workspace: string;
}

export async function runReviewer(
    taskState: TaskState,
    options: ReviewerOptions
): Promise<SubagentResult> {
    const startedAt = new Date().toISOString();
    logProgress(taskState, "Reviewer: iniciando revisión.");

    const conversation: ResponseInputItem[] = [];
    const prompt = `
Workspace: ${options.workspace}

Revisá el pedido y los cambios registrados en el estado compartido:
${summarizeForPrompt(taskState)}
    `.trim();

    try {
        const turnResult = await runAgentTurn(prompt, conversation, {
            mode: "reviewer",
            config: options.config,
            supervisionMode: false
        });
        const sources = repositorySourcesFromToolLog(turnResult.toolCallLog);
        const result: SubagentResult = {
            subagent: "reviewer",
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
            `Reviewer: revisión completa. ${sources.length} fuente(s) del repositorio consultadas.`
        );
        return result;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addObservation(taskState, `Reviewer falló: ${message}`, "blocker");
        const result: SubagentResult = {
            subagent: "reviewer",
            summary: `El Reviewer no pudo completar la revisión: ${message}`,
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
