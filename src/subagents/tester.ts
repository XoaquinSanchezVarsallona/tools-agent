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
import { repositorySourcesFromToolLog } from "./toolLog";

export interface TesterOptions {
    config: AgentConfig;
    workspace: string;
    supervisionMode?: boolean;
    confirmAction?: (message: string) => Promise<boolean>;
}

export async function runTester(
    taskState: TaskState,
    options: TesterOptions
): Promise<SubagentResult> {
    const startedAt = new Date().toISOString();
    logProgress(taskState, "Tester: iniciando verificación.");

    const conversation: ResponseInputItem[] = [];
    const prompt = `
Workspace: ${options.workspace}

Verificá el pedido y los cambios registrados en el estado compartido:
${summarizeForPrompt(taskState)}
    `.trim();

    try {
        const turnResult = await runAgentTurn(prompt, conversation, {
            mode: "tester",
            config: options.config,
            supervisionMode: options.supervisionMode ?? false,
            confirmAction: options.confirmAction
        });
        const sources = repositorySourcesFromToolLog(turnResult.toolCallLog);
        const failedCommands = commandFailures(turnResult.toolCallLog);
        const success = failedCommands.length === 0;

        if (!success) {
            addObservation(
                taskState,
                `Tester detectó ${failedCommands.length} comando(s) fallido(s) o denegado(s).`,
                "warning"
            );
        }

        const result: SubagentResult = {
            subagent: "tester",
            summary: turnResult.finalText,
            sources,
            filesTouched: [],
            success,
            raw: {
                iterations: turnResult.iterations,
                commandsRun: turnResult.toolCallLog.filter((entry) => entry.tool === "run_command").length,
                failedCommands
            },
            startedAt,
            finishedAt: new Date().toISOString()
        };

        recordSubagentResult(taskState, result);
        logProgress(
            taskState,
            success ? "Tester: verificación completa." : "Tester: verificación finalizada con fallas."
        );
        return result;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addObservation(taskState, `Tester falló: ${message}`, "blocker");
        const result: SubagentResult = {
            subagent: "tester",
            summary: `El Tester no pudo completar la verificación: ${message}`,
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

function commandFailures(log: ToolCallLogEntry[]): Array<{ command: string; reason: string }> {
    return log.flatMap((entry) => {
        if (entry.tool !== "run_command") return [];
        const command = (entry.args as { command?: string }).command ?? "(comando desconocido)";
        if (entry.denied) return [{ command, reason: entry.outputSummary }];

        const output = entry.rawOutput as { exitCode?: number };
        return output.exitCode && output.exitCode !== 0
            ? [{ command, reason: entry.outputSummary }]
            : [];
    });
}
