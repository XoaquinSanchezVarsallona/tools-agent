import type { ResponseInputItem } from "openai/resources/responses/responses";
import { runAgentTurn } from "./harness";
import {
    type SubagentName,
    type SubagentResult,
    type TaskState,
    addObservation,
    createTaskState,
    logProgress
} from "./taskState";
import type { AgentConfig } from "../policies/config";
import { runExplorer } from "../subagents/explorer";
import { runImplementer } from "../subagents/implementer";
import { runResearcher } from "../subagents/researcher";
import { runReviewer } from "../subagents/reviewer";
import { runTester } from "../subagents/tester";
import { getTelemetry, type Telemetry } from "../observability/telemetry";

export type OperatingStyle = "normal" | "orchestrator";

export interface OrchestratorOptions {
    config: AgentConfig;
    workspace: string;
    supervisionMode: boolean;
    confirmAction?: (message: string) => Promise<boolean>;
    onProgress?: (stage: string, message: string) => void;
    dependencies?: Partial<OrchestratorDependencies>;
    telemetry?: Telemetry;
}

export interface OrchestratedTurnResult {
    finalText: string;
    taskState: TaskState;
    selectedSubagents: SubagentName[];
    repairAttempted: boolean;
}

export interface RoutingDecision {
    taskBrief: string;
    useExplorer: boolean;
    useResearcher: boolean;
    researchQuery: string;
    useImplementer: boolean;
    useTester: boolean;
    useReviewer: boolean;
    rationale: string;
}

export interface AssessmentDecision {
    repairRequired: boolean;
    instructions: string;
}

export interface OrchestratorDependencies {
    route(
        request: string,
        conversation: ResponseInputItem[],
        config: AgentConfig,
        telemetry: Telemetry
    ): Promise<RoutingDecision>;
    assess(taskState: TaskState, conversation: ResponseInputItem[], config: AgentConfig, telemetry: Telemetry): Promise<AssessmentDecision>;
    synthesize(taskState: TaskState, conversation: ResponseInputItem[], config: AgentConfig, telemetry: Telemetry): Promise<string>;
    explorer: typeof runExplorer;
    researcher: typeof runResearcher;
    implementer: typeof runImplementer;
    tester: typeof runTester;
    reviewer: typeof runReviewer;
}

const DEFAULT_DEPENDENCIES: OrchestratorDependencies = {
    route: routeTask,
    assess: assessResults,
    synthesize: synthesizeResult,
    explorer: runExplorer,
    researcher: runResearcher,
    implementer: runImplementer,
    tester: runTester,
    reviewer: runReviewer
};

export async function runOrchestratedTurn(
    request: string,
    conversation: ResponseInputItem[],
    options: OrchestratorOptions
): Promise<OrchestratedTurnResult> {
    const telemetry = options.telemetry ?? getTelemetry(options.config.langfuse.enabled);
    return telemetry.observe("agent.orchestrator", "agent", {
        input: { request, workspace: options.workspace }
    }, async (observation) => {
        const result = await executeOrchestration(request, conversation, { ...options, telemetry });
        observation.update({ output: result });
        return result;
    });
}

async function executeOrchestration(
    request: string,
    conversation: ResponseInputItem[],
    options: OrchestratorOptions & { telemetry: Telemetry }
): Promise<OrchestratedTurnResult> {
    const dependencies = { ...DEFAULT_DEPENDENCIES, ...options.dependencies };
    options.onProgress?.("routing", "Seleccionando subagentes.");
    const route = enforceRoutingRules(
        await dependencies.route(request, conversation, options.config, options.telemetry)
    );
    const taskState = createTaskState(route.taskBrief);
    taskState.status = "in_progress";
    logProgress(taskState, `Orchestrator: ${route.rationale}`);

    const selectedSubagents = selectedNames(route);
    let implementerResult: SubagentResult | undefined;

    if (route.useExplorer) {
        await runStage("explorer", options, () => dependencies.explorer(taskState, {
            config: options.config,
            workspace: options.workspace,
            telemetry: options.telemetry
        }));
    }
    if (route.useResearcher) {
        await runStage("researcher", options, () => dependencies.researcher(
            taskState,
            route.researchQuery || route.taskBrief,
            { config: options.config, telemetry: options.telemetry }
        ));
    }
    if (route.useImplementer) {
        implementerResult = await runStage("implementer", options, () => dependencies.implementer(
            taskState,
            modifyingOptions(options)
        ));
    }

    if (!isBlockedImplementation(implementerResult, taskState)) {
        if (route.useTester) {
            await runStage("tester", options, () => dependencies.tester(
                taskState,
                modifyingOptions(options)
            ));
        }
        if (route.useReviewer) {
            await runStage("reviewer", options, () => dependencies.reviewer(taskState, {
                config: options.config,
                workspace: options.workspace,
                telemetry: options.telemetry
            }));
        }
    }

    let repairAttempted = false;
    if (route.useImplementer && taskState.status === "in_progress") {
        const assessment = await dependencies.assess(
            taskState, conversation, options.config, options.telemetry
        );
        if (assessment.repairRequired) {
            repairAttempted = true;
            addObservation(taskState, `Orchestrator pidió reparación: ${assessment.instructions}`, "warning");
            const repairResult = await runStage("implementer repair", options, () => dependencies.implementer(
                taskState,
                modifyingOptions(options)
            ));

            if (!isBlockedImplementation(repairResult, taskState)) {
                if (route.useTester) {
                    await runStage("tester repair", options, () => dependencies.tester(
                        taskState,
                        modifyingOptions(options)
                    ));
                }
                if (route.useReviewer) {
                    await runStage("reviewer repair", options, () => dependencies.reviewer(taskState, {
                        config: options.config,
                        workspace: options.workspace,
                        telemetry: options.telemetry
                    }));
                }
                const finalAssessment = await dependencies.assess(
                    taskState, conversation, options.config, options.telemetry
                );
                if (finalAssessment.repairRequired) {
                    addObservation(
                        taskState,
                        `Persisten problemas después del único ciclo de reparación: ${finalAssessment.instructions}`,
                        "blocker"
                    );
                    taskState.status = "failed";
                }
            }
        }
    }

    if (taskState.status === "in_progress") {
        taskState.status = latestSelectedResultsSucceeded(taskState, selectedSubagents)
            ? "completed"
            : "failed";
    }
    taskState.updatedAt = new Date().toISOString();

    options.onProgress?.("synthesis", "Preparando respuesta final.");
    const finalText = await dependencies.synthesize(
        taskState, conversation, options.config, options.telemetry
    );
    return { finalText, taskState, selectedSubagents, repairAttempted };
}

async function runStage<T extends SubagentResult>(
    stage: string,
    options: OrchestratorOptions,
    action: () => Promise<T>
): Promise<T> {
    options.onProgress?.(stage, "Iniciando.");
    const telemetry = options.telemetry ?? getTelemetry(options.config.langfuse.enabled);
    return telemetry.observe(`stage.${stage.replace(/\s+/g, "-")}`, "agent", {
        input: { stage }
    }, async (observation) => {
        const result = await action();
        observation.update({
            output: result,
            level: result.success ? "DEFAULT" : "ERROR",
            statusMessage: result.success ? undefined : result.summary
        });
        options.onProgress?.(stage, result.success ? "Completado." : "Finalizó con problemas.");
        return result;
    });
}

function modifyingOptions(options: OrchestratorOptions) {
    return {
        config: options.config,
        workspace: options.workspace,
        supervisionMode: options.supervisionMode,
        confirmAction: options.confirmAction,
        telemetry: options.telemetry
    };
}

function enforceRoutingRules(route: RoutingDecision): RoutingDecision {
    return route.useImplementer
        ? { ...route, useTester: true, useReviewer: true }
        : route;
}

function selectedNames(route: RoutingDecision): SubagentName[] {
    const selected: SubagentName[] = [];
    if (route.useExplorer) selected.push("explorer");
    if (route.useResearcher) selected.push("researcher");
    if (route.useImplementer) selected.push("implementer");
    if (route.useTester) selected.push("tester");
    if (route.useReviewer) selected.push("reviewer");
    return selected;
}

function isBlockedImplementation(result: SubagentResult | undefined, state: TaskState): boolean {
    if (!result || result.success) return false;
    const raw = result.raw as { blockedByApproval?: boolean } | undefined;
    state.status = raw?.blockedByApproval ? "blocked_needs_approval" : "failed";
    return true;
}

function latestSelectedResultsSucceeded(state: TaskState, selected: SubagentName[]): boolean {
    return selected.every((name) => {
        const result = [...state.subagentResults].reverse().find((item) => item.subagent === name);
        return result?.success ?? false;
    });
}

async function routeTask(
    request: string,
    conversation: ResponseInputItem[],
    config: AgentConfig,
    telemetry: Telemetry
): Promise<RoutingDecision> {
    const result = await runAgentTurn(request, conversation, {
        mode: "orchestrator_routing",
        config,
        supervisionMode: false,
        responseFormat: routingResponseFormat,
        telemetry
    });
    return JSON.parse(result.finalText) as RoutingDecision;
}

async function assessResults(
    taskState: TaskState,
    conversation: ResponseInputItem[],
    config: AgentConfig,
    telemetry: Telemetry
): Promise<AssessmentDecision> {
    const result = await runAgentTurn(orchestrationEvidence(taskState), conversation, {
        mode: "orchestrator_assessment",
        config,
        supervisionMode: false,
        responseFormat: assessmentResponseFormat,
        telemetry
    });
    return JSON.parse(result.finalText) as AssessmentDecision;
}

async function synthesizeResult(
    taskState: TaskState,
    conversation: ResponseInputItem[],
    config: AgentConfig,
    telemetry: Telemetry
): Promise<string> {
    const result = await runAgentTurn(orchestrationEvidence(taskState), conversation, {
        mode: "orchestrator_synthesis",
        config,
        supervisionMode: false,
        telemetry
    });
    return result.finalText;
}

function orchestrationEvidence(state: TaskState): string {
    return JSON.stringify({
        request: state.originalRequest,
        status: state.status,
        filesModified: state.filesModified,
        results: state.subagentResults.map((result) => ({
            subagent: result.subagent,
            success: result.success,
            summary: result.summary,
            filesTouched: result.filesTouched
        })),
        observations: state.observations
    }, null, 2);
}

const routingResponseFormat = {
    type: "json_schema" as const,
    name: "orchestration_route",
    strict: true,
    schema: {
        type: "object",
        properties: {
            taskBrief: { type: "string" },
            useExplorer: { type: "boolean" },
            useResearcher: { type: "boolean" },
            researchQuery: { type: "string" },
            useImplementer: { type: "boolean" },
            useTester: { type: "boolean" },
            useReviewer: { type: "boolean" },
            rationale: { type: "string" }
        },
        required: [
            "taskBrief", "useExplorer", "useResearcher", "researchQuery",
            "useImplementer", "useTester", "useReviewer", "rationale"
        ],
        additionalProperties: false
    }
};

const assessmentResponseFormat = {
    type: "json_schema" as const,
    name: "orchestration_assessment",
    strict: true,
    schema: {
        type: "object",
        properties: {
            repairRequired: { type: "boolean" },
            instructions: { type: "string" }
        },
        required: ["repairRequired", "instructions"],
        additionalProperties: false
    }
};
