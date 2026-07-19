import fs from "node:fs/promises";
import path from "node:path";
import { chunkSources } from "./chunk";
import { embedTexts, EMBEDDING_MODEL } from "./embeddings";
import { RAG_INDEX_PATH } from "./paths";
import { loadRagSources } from "./documentParser";
import type { RagIndex } from "./types";

export async function ingestRag() {
  const sources = await loadRagSources();
  const chunks = chunkSources(sources);
  const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

  const index: RagIndex = {
    embeddingModel: EMBEDDING_MODEL,
    generatedAt: new Date().toISOString(),
    chunks: chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index]
    }))
  };

  await fs.writeFile(RAG_INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf-8");

  return index;
}

if (path.basename(process.argv[1] ?? "") === "ingest.ts") {
  ingestRag()
    .then((index) => {
      console.log(`RAG index written to ${RAG_INDEX_PATH}`);
      console.log(`Chunks: ${index.chunks.length}`);
      console.log(`Embedding model: ${index.embeddingModel}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
