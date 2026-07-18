import { listFilesTool } from "./listFiles";
import { readFileTool } from "./readFile";
import { runCommandTool } from "./runCommand";
import { writeFileTool } from "./writeFile";

export const toolRegistry = {
    read_file: readFileTool,
    write_file: writeFileTool,
    list_files: listFilesTool,
    run_command: runCommandTool
};

export type ToolName = keyof typeof toolRegistry;
