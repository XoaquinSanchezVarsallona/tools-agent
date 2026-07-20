import { retrieveRelevantChunks } from "../rag/retrieve";

export async function ragSearchTool(args: { query: string }) {
  const chunks = await retrieveRelevantChunks(args.query, { topK: 6 });
  return {
    query: args.query,
    sufficient: chunks.length >= 2 && (chunks[0]?.score ?? 0) >= 0.35,
    chunks: chunks.map((chunk) => ({
      source: chunk.source,
      section: chunk.section,
      url: chunk.url,
      content: chunk.content,
      score: Number(chunk.score.toFixed(4))
    }))
  };
}
