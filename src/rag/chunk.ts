import crypto from "node:crypto";
import type { RagSource } from "./types";

const CHUNK_WORDS = 90;
const OVERLAP_WORDS = 20;

export type ChunkWithoutEmbedding = {
  id: string;
  source: string;
  section: string;
  url: string;
  content: string;
};

export function chunkSources(sources: RagSource[]): ChunkWithoutEmbedding[] {
  return sources.flatMap((source) => chunkSource(source));
}

function chunkSource(source: RagSource): ChunkWithoutEmbedding[] {
  const words = source.content.split(/\s+/).filter(Boolean);
  const chunks: ChunkWithoutEmbedding[] = [];
  let start = 0;
  let chunkNumber = 1;

  while (start < words.length) {
    const content = words.slice(start, start + CHUNK_WORDS).join(" ");
    const id = buildChunkId(source, chunkNumber, content);

    chunks.push({
      id,
      source: source.source,
      section: source.section,
      url: source.url,
      content
    });

    if (start + CHUNK_WORDS >= words.length) break;
    start += CHUNK_WORDS - OVERLAP_WORDS;
    chunkNumber++;
  }

  return chunks;
}

function buildChunkId(source: RagSource, chunkNumber: number, content: string) {
  const hash = crypto
    .createHash("sha256")
    .update(`${source.path}:${chunkNumber}:${content}`)
    .digest("hex")
    .slice(0, 12);

  return `${slug(source.source)}-${chunkNumber}-${hash}`;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
