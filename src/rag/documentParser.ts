import fs from "node:fs/promises";
import path from "node:path";
import { RAG_SOURCES_DIR } from "./paths";
import type { RagSource } from "./types";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export async function loadRagSources(): Promise<RagSource[]> {
  const entries = await fs.readdir(RAG_SOURCES_DIR, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(RAG_SOURCES_DIR, entry.name))
    .sort();

  return Promise.all(markdownFiles.map(readRagSource));
}

async function readRagSource(filePath: string): Promise<RagSource> {
  const raw = await fs.readFile(filePath, "utf-8");
  const match = raw.match(FRONTMATTER_PATTERN);

  if (!match) {
    throw new Error(`RAG source is missing frontmatter: ${filePath}`);
  }

  const metadata = parseFrontmatter(match[1]);
  const content = match[2].trim();

  assertMetadata(filePath, metadata);

  return {
    source: metadata.source,
    section: metadata.section,
    url: metadata.url,
    content,
    path: filePath
  };
}

function parseFrontmatter(raw: string) {
  const metadata: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    metadata[key] = value;
  }

  return metadata;
}

function assertMetadata(
  filePath: string,
  metadata: Record<string, string>
): asserts metadata is { source: string; section: string; url: string } {
  for (const key of ["source", "section", "url"]) {
    if (!metadata[key]) {
      throw new Error(`RAG source ${filePath} is missing '${key}' metadata`);
    }
  }
}
