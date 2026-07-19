import fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function writeFileTool(args: { path: string; content: string }) {
  await fs.writeFile(args.path, args.content, "utf-8");

  return {
    success: true,
    path: args.path,
    message: "Archivo escrito correctamente."
  };
}