import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function runCommandTool(args: { command: string }) {
  try {
    const { stdout, stderr } = await execAsync(args.command, {
      timeout: 30_000
    });

    return {
      command: args.command,
      stdout,
      stderr,
      exitCode: 0
    };
  } catch (error: any) {
    return {
      command: args.command,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message,
      exitCode: error.code ?? 1
    };
  }
}