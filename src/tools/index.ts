import { readFileTool } from "./readFile";
import { writeFileTool } from "./writeFile";
import { runCommandTool } from "./runCommand";
import { listFilesTool } from "./listFiles";
import { ragSearchTool } from "./ragSearch";
import { webSearchTool } from "./webSearch";
import { memoryReadTool, memoryWriteTool } from "./memory";

export const toolRegistry = {
  read_file: readFileTool,
  write_file: writeFileTool,
  list_files: listFilesTool,
  run_command: runCommandTool,
  rag_search: ragSearchTool,
  web_search: webSearchTool,
  memory_read: memoryReadTool,
  memory_write: memoryWriteTool
};

export type ToolName = keyof typeof toolRegistry;
