import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function runCommandTool(args: { command: string }) {
    try {
        const { stdout, stderr } = await execAsync(args.command, { timeout: 30_000 });
        return { command: args.command, stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
        const failure = error as { stdout?: string; stderr?: string; message?: string; code?: number };
        return {
            command: args.command,
            stdout: failure.stdout ?? "",
            stderr: failure.stderr ?? failure.message ?? String(error),
            exitCode: failure.code ?? 1
        };
    }
}
