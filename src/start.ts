import path from "node:path";

const workspace = process.env.DESIGN_AGENT_WORKSPACE;

if (workspace) {
  process.chdir(path.resolve(workspace));
}

void import("./index.js");
