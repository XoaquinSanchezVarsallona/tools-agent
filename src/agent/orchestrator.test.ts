import assert from "node:assert/strict";
import test from "node:test";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import {
    runOrchestratedTurn,
    type AssessmentDecision,
    type OrchestratorDependencies,
    type RoutingDecision
} from "./orchestrator";
import {
    type SubagentName,
    type SubagentResult,
    type TaskState,
    recordSubagentResult
} from "./taskState";
import type { AgentConfig } from "../policies/config";

const config: AgentConfig = {
    model: "test-model",
    embeddingModel: "test-embedding",
    maxIterations: 4,
    conversationWindow: 10,
    paths: { memory: "memory", rag: "rag", tasks: "tasks" },
    policies: { deniedRead: [], deniedWrite: [], deniedCommands: [], approvalCommands: [] },
    verificationCommands: [],
    loopDetection: { repeatedActionLimit: 2, replanLimit: 1 },
    langfuse: { enabled: false }
};

test("implementation routes always include tester and reviewer", async () => {
    const calls: string[] = [];
    const result = await runWith({
        route: decision({ useImplementer: true }),
        assessments: [{ repairRequired: false, instructions: "" }],
        calls
    });

    assert.deepEqual(calls, ["implementer", "tester", "reviewer"]);
    assert.deepEqual(result.selectedSubagents, ["implementer", "tester", "reviewer"]);
    assert.equal(result.taskState.status, "completed");
    assert.equal(result.repairAttempted, false);
});

test("tester or reviewer findings trigger exactly one repair cycle", async () => {
    const calls: string[] = [];
    const result = await runWith({
        route: decision({ useImplementer: true }),
        assessments: [
            { repairRequired: true, instructions: "Corregir la regresión." },
            { repairRequired: false, instructions: "" }
        ],
        calls
    });

    assert.deepEqual(calls, [
        "implementer", "tester", "reviewer",
        "implementer", "tester", "reviewer"
    ]);
    assert.equal(result.repairAttempted, true);
    assert.equal(result.taskState.status, "completed");
    assert.match(result.taskState.observations[0]?.message ?? "", /Corregir la regresión/);
});

test("approval rejection blocks orchestration before verification", async () => {
    const calls: string[] = [];
    const dependencies = dependenciesFor(
        decision({ useImplementer: true }),
        [{ repairRequired: false, instructions: "" }],
        calls
    );
    dependencies.implementer = async (state) => {
        calls.push("implementer");
        return addResult(state, "implementer", false, { blockedByApproval: true });
    };

    const result = await runOrchestratedTurn("change it", [], baseOptions(dependencies));

    assert.deepEqual(calls, ["implementer"]);
    assert.equal(result.taskState.status, "blocked_needs_approval");
    assert.equal(result.repairAttempted, false);
});

test("read-only orchestration runs only selected roles", async () => {
    const calls: string[] = [];
    const result = await runWith({
        route: decision({ useExplorer: true, useReviewer: true }),
        assessments: [],
        calls
    });

    assert.deepEqual(calls, ["explorer", "reviewer"]);
    assert.equal(result.taskState.status, "completed");
});

test("research-only routes pass through the selected researcher", async () => {
    const calls: string[] = [];
    const result = await runWith({
        route: decision({
            useResearcher: true,
            researchQuery: "official API behavior"
        }),
        assessments: [],
        calls
    });

    assert.deepEqual(calls, ["researcher"]);
    assert.deepEqual(result.selectedSubagents, ["researcher"]);
    assert.equal(result.taskState.status, "completed");
});

test("persistent findings fail after one repair without a second retry", async () => {
    const calls: string[] = [];
    const result = await runWith({
        route: decision({ useImplementer: true }),
        assessments: [
            { repairRequired: true, instructions: "Primera corrección." },
            { repairRequired: true, instructions: "El problema persiste." }
        ],
        calls
    });
    console.log("Calls made:", calls);
    console.log("Final result:", result);
    assert.equal(calls.filter((call) => call === "implementer").length, 2);
    assert.equal(result.repairAttempted, true);
    assert.equal(result.taskState.status, "failed");
    assert.match(result.taskState.observations.at(-1)?.message ?? "", /persiste/i);
});

async function runWith(input: {
    route: RoutingDecision;
    assessments: AssessmentDecision[];
    calls: string[];
}) {
    return runOrchestratedTurn(
        "request",
        [] as ResponseInputItem[],
        baseOptions(dependenciesFor(input.route, input.assessments, input.calls))
    );
}

function baseOptions(dependencies: Partial<OrchestratorDependencies>) {
    return {
        config,
        workspace: ".",
        supervisionMode: true,
        dependencies
    };
}

function dependenciesFor(
    route: RoutingDecision,
    assessments: AssessmentDecision[],
    calls: string[]
): Partial<OrchestratorDependencies> {
    let assessmentIndex = 0;
    return {
        route: async () => route,
        assess: async () => assessments[assessmentIndex++] ?? {
            repairRequired: false,
            instructions: ""
        },
        synthesize: async (state) => `status:${state.status}`,
        explorer: async (state) => roleResult(state, "explorer", calls),
        researcher: async (state) => roleResult(state, "researcher", calls),
        implementer: async (state) => roleResult(state, "implementer", calls),
        tester: async (state) => roleResult(state, "tester", calls),
        reviewer: async (state) => roleResult(state, "reviewer", calls)
    };
}

function roleResult(state: TaskState, name: SubagentName, calls: string[]) {
    calls.push(name);
    return addResult(state, name, true);
}

function addResult(
    state: TaskState,
    subagent: SubagentName,
    success: boolean,
    raw?: unknown
): SubagentResult {
    const now = new Date().toISOString();
    const result: SubagentResult = {
        subagent,
        summary: `${subagent} result`,
        sources: [],
        filesTouched: [],
        success,
        raw,
        startedAt: now,
        finishedAt: now
    };
    recordSubagentResult(state, result);
    return result;
}

function decision(overrides: Partial<RoutingDecision>): RoutingDecision {
    return {
        taskBrief: "Standalone task",
        useExplorer: false,
        useResearcher: false,
        researchQuery: "",
        useImplementer: false,
        useTester: false,
        useReviewer: false,
        rationale: "Test route",
        ...overrides
    };
}
