import { readFileToolDefinition } from "./read_file";
import { writeFileToolDefinition } from "./write_file";
import { listFilesToolDefinition } from "./list_files";
import { runCommandToolDefinition } from "./run_command";

export const toolDefinitions = [
  readFileToolDefinition,
  writeFileToolDefinition,
  listFilesToolDefinition,
  runCommandToolDefinition
];
