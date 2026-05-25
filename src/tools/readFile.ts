import fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function readFileTool(args: { path: string }) {
  const content = await fs.readFile(args.path, "utf-8");

  return {
    path: args.path,
    content
  };
}