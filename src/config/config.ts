import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { AgentConfig } from "../domain/types";
const schema = z.object({ model: z.string().min(1), embeddingModel: z.string().min(1), maxIterations: z.number().int().positive(), conversationWindow: z.number().int().positive(), paths: z.object({ memory: z.string(), rag: z.string(), tasks: z.string() }), policies: z.object({ deniedRead: z.array(z.string()), deniedWrite: z.array(z.string()), deniedCommands: z.array(z.string()), approvalCommands: z.array(z.string()) }), verificationCommands: z.array(z.string()), loopDetection: z.object({ repeatedActionLimit: z.number().int().positive(), replanLimit: z.number().int().nonnegative() }), langfuse: z.object({ enabled: z.boolean() }) });
export async function loadConfig(root: string): Promise<AgentConfig> { return schema.parse(JSON.parse(await fs.readFile(path.join(root, "agent.config.json"), "utf8"))); }
