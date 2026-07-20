import assert from "node:assert/strict";
import test from "node:test";
import type { Response, ResponseInputItem } from "openai/resources/responses/responses";
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
import { runAgentTurn } from "./harness";
import { InMemoryTelemetry, type MemoryObservation } from "../observability/telemetry";
import type { ToolName } from "../tools";

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
    assert.equal(calls.filter((call) => call === "implementer").length, 2);
    assert.equal(result.repairAttempted, true);
    assert.equal(result.taskState.status, "failed");
    assert.match(result.taskState.observations.at(-1)?.message ?? "", /persiste/i);
});

test("agent flow creates a complete Langfuse-compatible telemetry trace", async () => {
    const telemetry = new InMemoryTelemetry({ inputPerMillion: 2, outputPerMillion: 8 });
    const responses = [
        responseWithRepositoryTools(),
        finalResponse("Repository inspection complete"),
        responseWithWebSearch(),
        finalResponse("Telemetry complete")
    ];

    const runtime = {
        createResponse: async () => responses.shift() ?? finalResponse("Unexpected call"),
        executeTool: async (tool: ToolName, args: unknown) => {
            if (tool === "read_file") {
                return { path: (args as { path: string }).path, content: "Retrieved document body" };
            }
            if (tool === "web_search") {
                return {
                    query: "Langfuse TypeScript",
                    results: [{
                        title: "Langfuse docs",
                        url: "https://langfuse.com/docs",
                        snippet: "Official observability documentation"
                    }]
                };
            }
            return { error: "Simulated command failure" };
        }
    };
    const agentOptions = {
        config: { ...config, model: "gpt-test", langfuse: { enabled: true } },
        supervisionMode: false,
        telemetry,
        runtime
    };

    const result = await telemetry.observe("test.agent-flow", "agent", {
        input: "Inspect docs, search the web, and report."
    }, async (trace) => {
        await runAgentTurn("Inspect repository docs.", [], { ...agentOptions, mode: "normal" });
        const webResult = await runAgentTurn("Search official docs.", [], {
            ...agentOptions,
            mode: "researcher_web"
        });
        trace.update({ output: webResult.finalText });
        return webResult;
    });

    assert.equal(result.finalText, "Telemetry complete");
    assert.equal(telemetry.traces.length, 1);
    const trace = telemetry.traces[0];
    const observations = flatten(trace);

    assert.equal(trace.type, "agent");
    assert.match(JSON.stringify(trace.input), /Inspect docs/);
    assert.match(JSON.stringify(trace.output), /Telemetry complete/);
    assert.equal(observations.filter((item) => item.name.startsWith("iteration.")).length, 4);
    assert.ok(observations.some((item) => item.name === "prompt.construction"));

    const generations = observations.filter((item) => item.type === "generation");
    assert.equal(generations.length, 4);
    assert.ok(generations.every((item) => item.model === "gpt-test"));
    assert.match(JSON.stringify(generations[0]?.input), /Inspect repository docs/);
    assert.match(JSON.stringify(generations[0]?.input), /Sos un coding agent/);
    assert.ok(generations.every((item) => (item.usageDetails?.total ?? 0) > 0));
    assert.ok(generations.every((item) => (item.costDetails?.total ?? 0) > 0));

    const document = observations.find((item) => item.name === "tool.read_file");
    assert.equal(document?.type, "retriever");
    assert.match(JSON.stringify(document?.output), /Retrieved document body/);

    const webSearch = observations.find((item) => item.name === "tool.web_search");
    assert.equal(webSearch?.type, "tool");
    assert.match(JSON.stringify(webSearch?.output), /https:\/\/langfuse.com\/docs/);
    assert.equal(webSearch?.metadata?.category, "web_search");

    const error = observations.find((item) => item.name === "tool.run_command");
    assert.equal(error?.level, "ERROR");
    assert.match(error?.statusMessage ?? "", /Simulated command failure/);
    assert.ok(observations.every((item) => typeof item.latencyMs === "number"));
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

function responseWithRepositoryTools(): Response {
    return {
        output_text: "",
        output: [
            toolCall("call-read", "read_file", { path: "docs/guide.md" }),
            toolCall("call-command", "run_command", { command: "npm test" })
        ],
        usage: usage(100, 20)
    } as unknown as Response;
}

function responseWithWebSearch(): Response {
    return {
        output_text: "",
        output: [
            toolCall("call-web", "web_search", { query: "Langfuse TypeScript", maxResults: 1 })
        ],
        usage: usage(80, 15)
    } as unknown as Response;
}

function finalResponse(text: string): Response {
    return {
        output_text: text,
        output: [{ type: "message", role: "assistant", content: [] }],
        usage: usage(50, 10)
    } as unknown as Response;
}

function toolCall(callId: string, name: string, args: unknown) {
    return {
        type: "function_call",
        call_id: callId,
        name,
        arguments: JSON.stringify(args)
    };
}

function usage(input: number, output: number) {
    return {
        input_tokens: input,
        input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
        output_tokens: output,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: input + output
    };
}

function flatten(root: MemoryObservation): MemoryObservation[] {
    return [root, ...root.children.flatMap(flatten)];
}
