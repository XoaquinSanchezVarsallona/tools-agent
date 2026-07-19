import path from "node:path";
import { AgentConfig } from "../policies/config";
import { Source } from "../agent/taskState";
import { embedText } from "./embeddings";
import { RetrievedChunk, VectorStore } from "./store";
import { getTelemetry, type Telemetry } from "../observability/telemetry";

const DEFAULT_TOP_K = 5;
export const DEFAULT_MIN_SCORE = 0.55;

export interface RagResult {
    chunks: RetrievedChunk[];
    sources: Source[];
    hasEnoughEvidence: boolean;
}

export async function retrieveFromRag(
    query: string,
    config: AgentConfig,
    topK: number = DEFAULT_TOP_K,
    minScore: number = DEFAULT_MIN_SCORE,
    telemetry: Telemetry = getTelemetry(config.langfuse.enabled)
): Promise<RagResult> {
    return telemetry.observe("rag.retrieve", "retriever", {
        input: { query, topK, minScore, store: config.paths.rag }
    }, async (observation) => {
        const store = new VectorStore(path.resolve(config.paths.rag));
        try {
            const queryEmbedding = await embedText(query, config.embeddingModel, telemetry);
            const chunks = store.search(queryEmbedding, topK, minScore);
            const sources: Source[] = chunks.map((chunk) => ({
                type: "rag" as const,
                ref: `${chunk.source}#${chunk.heading} (chunk ${chunk.chunkIndex})`,
                snippet: chunk.content.slice(0, 300),
                retrievedAt: new Date().toISOString()
            }));
            const result = { chunks, sources, hasEnoughEvidence: chunks.length > 0 };
            observation.update({
                output: {
                    documents: chunks.map((chunk) => ({
                        source: chunk.source,
                        heading: chunk.heading,
                        chunkIndex: chunk.chunkIndex,
                        score: chunk.score,
                        content: chunk.content
                    })),
                    hasEnoughEvidence: result.hasEnoughEvidence
                }
            });
            return result;
        } finally {
            store.close();
        }
    });
}
