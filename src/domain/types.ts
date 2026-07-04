import type OpenAI from "openai";
export type EvidenceOrigin = "repository" | "memory" | "rag" | "web" | "inference";
export type AgentRole = "explorer" | "researcher" | "implementer" | "tester" | "reviewer";
export interface Evidence { origin: EvidenceOrigin; document: string; excerpt: string; location?: string; }
export interface AgentResult { role: AgentRole; summary: string; evidence: Evidence[]; status: "completed" | "blocked" | "failed"; iterations: number; }
export interface TaskState { id: string; project: string; originalRequest: string; status: "running" | "completed" | "blocked" | "failed"; progress: AgentRole[]; results: Partial<Record<AgentRole, AgentResult>>; sources: Evidence[]; modifiedFiles: string[]; observations: string[]; startedAt: string; updatedAt: string; }
export interface AgentConfig { model: string; embeddingModel: string; maxIterations: number; conversationWindow: number; paths: { memory: string; rag: string; tasks: string }; policies: { deniedRead: string[]; deniedWrite: string[]; deniedCommands: string[]; approvalCommands: string[] }; verificationCommands: string[]; loopDetection: { repeatedActionLimit: number; replanLimit: number }; langfuse: { enabled: boolean }; }
export interface AgentDependencies { client: OpenAI; config: AgentConfig; projectRoot: string; confirmAction?: (message: string) => Promise<boolean>; }
