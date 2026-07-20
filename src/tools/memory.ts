import { readProjectMemory, writeProjectMemory } from "../agent/memory";

export async function memoryReadTool() {
  return readProjectMemory();
}

export async function memoryWriteTool(args: {
  summary: string;
  importantFiles: string[];
  conventions: string[];
}) {
  const memory = await readProjectMemory();
  memory.lastTaskSummary = args.summary;
  memory.importantFiles = unique([...memory.importantFiles, ...args.importantFiles]).slice(-20);
  memory.conventions = unique([...memory.conventions, ...args.conventions]).slice(-20);
  return writeProjectMemory(memory);
}

function unique(values: string[]) {
  return [...new Set(values)];
}
