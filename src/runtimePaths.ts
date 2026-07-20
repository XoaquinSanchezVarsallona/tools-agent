import path from "node:path";

export const agentRoot = path.resolve(
  process.env.DESIGN_AGENT_ROOT ?? process.cwd()
);

export const workspaceRoot = process.cwd();
