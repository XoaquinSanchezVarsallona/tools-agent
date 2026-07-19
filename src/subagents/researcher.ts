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
import { DEFAULT_MIN_SCORE, retrieveFromRag } from "../rag/retrieve";
import { WebSearchOutput } from "../tools/webSearch";
import { getTelemetry, type Telemetry } from "../observability/telemetry";

export interface ResearcherOptions {
    config: AgentConfig;
    telemetry?: Telemetry;
}

export async function runResearcher(
    taskState: TaskState,
    query: string,
    options: ResearcherOptions
): Promise<SubagentResult> {
    const telemetry = options.telemetry ?? getTelemetry(options.config.langfuse.enabled);
    return telemetry.observe("subagent.researcher", "agent", {
        input: { query, request: taskState.originalRequest }
    }, async (observation) => {
        const result = await runResearcherInternal(taskState, query, { ...options, telemetry });
        observation.update({
            output: result,
            level: result.success ? "DEFAULT" : "ERROR",
            statusMessage: result.success ? undefined : result.summary
        });
        return result;
    });
}

async function runResearcherInternal(
    taskState: TaskState,
    query: string,
    options: ResearcherOptions & { telemetry: Telemetry }
): Promise<SubagentResult> {
    const startedAt = new Date().toISOString();
    logProgress(taskState, `Researcher: consultando RAG para: "${query}"`);

    const ragResult = await retrieveFromRag(query, options.config, undefined, undefined, options.telemetry);

    if (ragResult.hasEnoughEvidence) {
        return synthesizeFromRag(taskState, query, ragResult, startedAt, options);
    }

    addObservation(
        taskState,
        `Researcher: el RAG no devolvió evidencia suficiente (0 chunks por encima de minScore=${DEFAULT_MIN_SCORE}) para "${query}". Cayendo a búsqueda web.`,
        "warning"
    );

    return researchFromWeb(taskState, query, startedAt, options);
}

async function synthesizeFromRag(
    taskState: TaskState,
    query: string,
    ragResult: Awaited<ReturnType<typeof retrieveFromRag>>,
    startedAt: string,
    options: ResearcherOptions
): Promise<SubagentResult> {
    const contextText = ragResult.chunks
        .map(
            (c, i) =>
                `[Fragmento ${i + 1}] (fuente: ${c.source}, sección: "${c.heading}", score: ${c.score.toFixed(3)})\n${c.content}`
        )
        .join("\n\n---\n\n");

    const prompt = `
Pregunta: "${query}"

Contexto recuperado del RAG:

${contextText}
  `.trim();

    const conversation: ResponseInputItem[] = [];

    let turnResult;
    try {
        turnResult = await runAgentTurn(prompt, conversation, {
            mode: "researcher_synthesis",
            config: options.config,
            supervisionMode: false,
            taskState,
            telemetry: options.telemetry
        });
    } catch (error: unknown) {
        return failResult(taskState, startedAt, error);
    }

    const result: SubagentResult = {
        subagent: "researcher",
        summary: turnResult.finalText,
        sources: ragResult.sources,
        filesTouched: [],
        success: true,
        raw: { origin: "rag", chunkCount: ragResult.chunks.length },
        startedAt,
        finishedAt: new Date().toISOString()
    };

    recordSubagentResult(taskState, result);
    logProgress(
        taskState,
        `Researcher: respondió usando RAG (${ragResult.chunks.length} fragmento(s), sin necesidad de web).`
    );

    return result;
}

async function researchFromWeb(
    taskState: TaskState,
    query: string,
    startedAt: string,
    options: ResearcherOptions
): Promise<SubagentResult> {
    const conversation: ResponseInputItem[] = [];

    let turnResult;
    try {
        turnResult = await runAgentTurn(query, conversation, {
            mode: "researcher_web",
            config: options.config,
            supervisionMode: false,
            taskState,
            telemetry: options.telemetry
        });
    } catch (error: unknown) {
        return failResult(taskState, startedAt, error);
    }

    const sources = buildSourcesFromWebSearches(turnResult.toolCallLog);

    const result: SubagentResult = {
        subagent: "researcher",
        summary: turnResult.finalText,
        sources,
        filesTouched: [],
        success: true,
        raw: { origin: "web", iterations: turnResult.iterations },
        startedAt,
        finishedAt: new Date().toISOString()
    };

    recordSubagentResult(taskState, result);
    logProgress(
        taskState,
        `Researcher: respondió usando búsqueda web (${sources.length} fuente(s) citadas).`
    );

    return result;
}

function buildSourcesFromWebSearches(log: ToolCallLogEntry[]): Source[] {
    const sources: Source[] = [];
    for (const entry of log) {
        if (entry.tool !== "web_search" || entry.denied) continue;
        const output = entry.rawOutput as WebSearchOutput;
        for (const item of output.results ?? []) {
            sources.push({
                type: "web" as const,
                ref: item.url,
                snippet: item.snippet || item.title,
                retrievedAt: new Date().toISOString()
            });
        }
    }
    return sources;
}

function failResult(taskState: TaskState, startedAt: string, error: unknown): SubagentResult {
    const message = error instanceof Error ? error.message : String(error);
    addObservation(taskState, `Researcher falló: ${message}`, "blocker");
    const result: SubagentResult = {
        subagent: "researcher",
        summary: `El Researcher no pudo completar la investigación: ${message}`,
        sources: [],
        filesTouched: [],
        success: false,
        startedAt,
        finishedAt: new Date().toISOString()
    };
    recordSubagentResult(taskState, result);
    return result;
}
