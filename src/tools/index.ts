import { readFileTool } from "./readFile";
import { writeFileTool } from "./writeFile";
import { runCommandTool } from "./runCommand";
import { listFilesTool } from "./listFiles";

export const toolRegistry = {
  read_file: readFileTool,
  write_file: writeFileTool,
  list_files: listFilesTool,
  run_command: runCommandTool
};

export type ToolName = keyof typeof toolRegistry;