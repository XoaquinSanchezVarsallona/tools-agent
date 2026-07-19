import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type CommandResult = {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function buildStorybook(): Promise<CommandResult> {
  const command = "npm run build-storybook";

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 120_000
    });

    return { command, stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      command,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message,
      exitCode: error.code ?? 1
    };
  }
}
