#!/usr/bin/env node

const path = require("node:path");
const { spawn } = require("node:child_process");

const packageRoot = path.resolve(__dirname, "..");
const workspace = process.cwd();
const isWindows = process.platform === "win32";
const command = isWindows ? process.env.ComSpec ?? "cmd.exe" : "npm";
const args = isWindows
  ? ["/d", "/c", "npm", "--prefix", packageRoot, "run", "--silent", "start"]
  : ["--prefix", packageRoot, "run", "--silent", "start"];

const child = spawn(
  command,
  args,
  {
    cwd: packageRoot,
    env: {
      ...process.env,
      DESIGN_AGENT_ROOT: packageRoot,
      DESIGN_AGENT_WORKSPACE: workspace
    },
    stdio: "inherit"
  }
);

child.on("error", (error) => {
  console.error(`No se pudo iniciar design-agent: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
