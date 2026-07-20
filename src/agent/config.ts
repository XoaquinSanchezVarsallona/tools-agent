import fs from "node:fs/promises";
import path from "node:path";
import type { ToolName } from "../tools";
import { agentRoot, workspaceRoot } from "../runtimePaths";

export type AgentConfig = {
  workspace: string;
  permissions: { readDeny: string[]; writeDeny: string[] };
  commands: { deny: string[]; requireApproval: string[] };
};

export async function loadAgentConfig(): Promise<AgentConfig> {
  const config = JSON.parse(
    await fs.readFile(path.join(agentRoot, "agent.config.json"), "utf-8")
  ) as AgentConfig;

  if (
    !config.workspace ||
    !Array.isArray(config.permissions?.readDeny) ||
    !Array.isArray(config.permissions?.writeDeny) ||
    !Array.isArray(config.commands?.deny) ||
    !Array.isArray(config.commands?.requireApproval)
  ) {
    throw new Error("agent.config.json is invalid");
  }

  return { ...config, workspace: workspaceRoot };
}

export function checkPolicy(
  config: AgentConfig,
  toolName: ToolName,
  args: any
): { allowed: boolean; requiresApproval: boolean; reason?: string } {
  if (toolName === "read_file" || toolName === "list_files" || toolName === "write_file") {
    const target = resolveWorkspacePath(config, String(args.path ?? ""));
    if (!target.allowed) return { allowed: false, requiresApproval: false, reason: target.reason };

    const denied = toolName === "write_file"
      ? config.permissions.writeDeny
      : config.permissions.readDeny;
    const relative = normalize(path.relative(path.resolve(config.workspace), target.path!));
    const match = denied.find((pattern) => matches(pattern, relative));
    if (match) {
      return { allowed: false, requiresApproval: false, reason: `Path denied by ${match}` };
    }
  }

  if (toolName === "run_command") {
    const command = String(args.command ?? "").toLowerCase();
    const denied = config.commands.deny.find((item) => command.includes(item.toLowerCase()));
    if (denied) return { allowed: false, requiresApproval: false, reason: `Command denied: ${denied}` };
    const approval = config.commands.requireApproval.some((item) =>
      command.includes(item.toLowerCase())
    );
    return { allowed: true, requiresApproval: approval };
  }

  return { allowed: true, requiresApproval: false };
}

function resolveWorkspacePath(config: AgentConfig, input: string) {
  const workspace = path.resolve(config.workspace);
  const resolved = path.resolve(workspace, input);
  if (resolved !== workspace && !resolved.startsWith(`${workspace}${path.sep}`)) {
    return { allowed: false, reason: "Path is outside the configured workspace" };
  }
  return { allowed: true, path: resolved };
}

function matches(pattern: string, relativePath: string) {
  const normalizedPattern = normalize(pattern);
  if (normalizedPattern.startsWith("**/")) {
    return relativePath.endsWith(normalizedPattern.slice(3));
  }
  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -3);
    return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
  }
  return relativePath === normalizedPattern;
}

function normalize(value: string) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}
