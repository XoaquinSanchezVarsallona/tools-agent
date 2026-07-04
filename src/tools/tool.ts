import type { ZodType } from "zod";
import type { AgentRole } from "../domain/types";
import type { ToolEffect } from "../services/policy";
export interface ToolContext { role: AgentRole; }
export interface AgentTool<T> { name: string; description: string; parameters: Record<string, unknown>; schema: ZodType<T>; effect: ToolEffect; allowedRoles: AgentRole[]; execute(args: T, context: ToolContext): Promise<unknown>; }
export class ToolException extends Error {}
export class ToolRegistry { private readonly tools = new Map<string, AgentTool<unknown>>(); register<T>(tool: AgentTool<T>) { if (this.tools.has(tool.name)) throw new ToolException(`Tool duplicada: ${tool.name}`); this.tools.set(tool.name, tool as AgentTool<unknown>); return this; } get(name: string) { const tool = this.tools.get(name); if (!tool) throw new ToolException(`Tool desconocida: ${name}`); return tool; } forRole(role: AgentRole) { return [...this.tools.values()].filter((tool) => tool.allowedRoles.includes(role)); } }
