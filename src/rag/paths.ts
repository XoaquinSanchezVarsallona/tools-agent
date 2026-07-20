import path from "node:path";
import { agentRoot } from "../runtimePaths";

export const RAG_DIR = path.join(agentRoot, "rag");
export const RAG_SOURCES_DIR = path.join(RAG_DIR, "sources");
export const RAG_INDEX_PATH = path.join(RAG_DIR, "index.json");
