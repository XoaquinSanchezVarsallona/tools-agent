export type SourceType = "repository" | "memory" | "rag" | "web" | "inference";

export interface Source {
    type: SourceType;
    ref: string;
    snippet?: string;
    retrievedAt: string;
}

export type SubagentName =
    | "explorer"
    | "researcher"
    | "implementer"
    | "tester"
    | "reviewer";

export interface SubagentResult {
    subagent: SubagentName;
    summary: string;
    sources: Source[];
    filesTouched: string[];
    success: boolean;
    raw?: unknown;
    startedAt: string;
    finishedAt: string;
}

export interface Observation {
    at: string;
    message: string;
    severity: "info" | "warning" | "blocker";
}

export type TaskStatus =
    | "planning"
    | "in_progress"
    | "blocked_needs_approval"
    | "blocked_insufficient_evidence"
    | "completed"
    | "failed";

export interface TaskState {
    id: string;
    originalRequest: string;
    status: TaskStatus;
    createdAt: string;
    updatedAt: string;
    progressLog: string[];
    subagentResults: SubagentResult[];
    sourcesConsulted: Source[];
    filesModified: string[];
    observations: Observation[];
    recentActions: RecentAction[];
}

export interface RecentAction {
    at: string;
    tool: string;
    argsFingerprint: string;
    outcomeFingerprint: string;
}

export function createTaskState(originalRequest: string): TaskState {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        originalRequest,
        status: "planning",
        createdAt: now,
        updatedAt: now,
        progressLog: [],
        subagentResults: [],
        sourcesConsulted: [],
        filesModified: [],
        observations: [],
        recentActions: []
    };
}

export function logProgress(state: TaskState, message: string): void {
    state.progressLog.push(`[${new Date().toISOString()}] ${message}`);
    state.updatedAt = new Date().toISOString();
}

export function addObservation(
    state: TaskState,
    message: string,
    severity: Observation["severity"] = "info"
): void {
    state.observations.push({ at: new Date().toISOString(), message, severity });
    state.updatedAt = new Date().toISOString();
}

export function recordSubagentResult(state: TaskState, result: SubagentResult): void {
    state.subagentResults.push(result);
    for (const source of result.sources) {
        state.sourcesConsulted.push(source);
    }
    for (const file of result.filesTouched) {
        if (!state.filesModified.includes(file)) {
            state.filesModified.push(file);
        }
    }
    state.updatedAt = new Date().toISOString();
}

export function recordAction(
    state: TaskState,
    tool: string,
    argsFingerprint: string,
    outcomeFingerprint: string
): void {
    state.recentActions.push({
        at: new Date().toISOString(),
        tool,
        argsFingerprint,
        outcomeFingerprint
    });
    if (state.recentActions.length > 20) {
        state.recentActions.shift();
    }
    state.updatedAt = new Date().toISOString();
}

export function summarizeForPrompt(state: TaskState): string {
    const lastResults = state.subagentResults
        .slice(-3)
        .map((r) => `- [${r.subagent}] ${r.success ? "OK" : "FALLÓ"}: ${r.summary}`)
        .join("\n");

    const lastObservations = state.observations
        .slice(-5)
        .map((o) => `- (${o.severity}) ${o.message}`)
        .join("\n");

    return `
Pedido original: ${state.originalRequest}
Estado: ${state.status}
Archivos modificados hasta ahora: ${state.filesModified.join(", ") || "ninguno"}

Últimos resultados de subagentes:
${lastResults || "(ninguno todavía)"}

Observaciones recientes:
${lastObservations || "(ninguna)"}
`.trim();
}