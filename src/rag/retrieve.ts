import fs from "node:fs/promises";
import { embedTexts } from "./embeddings";
import { RAG_INDEX_PATH } from "./paths";
import type { RagIndex, RetrievedChunk } from "./types";

export async function retrieveRelevantChunks(
  query: string,
  options: { topK?: number } = {}
): Promise<RetrievedChunk[]> {
  const topK = options.topK ?? 6;
  const index = await readRagIndex();
  const [queryEmbedding] = await embedTexts([query]);

  return index.chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

export async function readRagIndex(): Promise<RagIndex> {
  const raw = await fs.readFile(RAG_INDEX_PATH, "utf-8");
  return JSON.parse(raw) as RagIndex;
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length) {
    throw new Error("Cannot compare embeddings with different dimensions");
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index++) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
