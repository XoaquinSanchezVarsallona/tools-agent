import path from "node:path";

export const RAG_DIR = path.resolve("rag");
export const RAG_SOURCES_DIR = path.join(RAG_DIR, "sources");
export const RAG_INDEX_PATH = path.join(RAG_DIR, "index.json");
