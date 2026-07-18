import path from "node:path";
import { AgentConfig } from "../policies/config";
import { Source } from "../agent/taskState";
import { embedText } from "./embeddings";
import { RetrievedChunk, VectorStore } from "./store";

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
    minScore: number = DEFAULT_MIN_SCORE
): Promise<RagResult> {
    const store = new VectorStore(path.resolve(config.paths.rag));
    const queryEmbedding = await embedText(query, config.embeddingModel);
    const chunks = store.search(queryEmbedding, topK, minScore);
    store.close();

    const sources: Source[] = chunks.map((chunk) => ({
        type: "rag" as const,
        ref: `${chunk.source}#${chunk.heading} (chunk ${chunk.chunkIndex})`,
        snippet: chunk.content.slice(0, 300),
        retrievedAt: new Date().toISOString()
    }));

    return {
        chunks,
        sources,
        hasEnoughEvidence: chunks.length > 0
    };
}