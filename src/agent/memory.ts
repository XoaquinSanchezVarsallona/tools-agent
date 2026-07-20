import fs from "node:fs/promises";
import path from "node:path";
import type { TaskState } from "./state";

const MEMORY_PATH = path.resolve(".agent/memory.json");

export type ProjectMemory = {
  architecture: string[];
  dependencies: string[];
  importantFiles: string[];
  conventions: string[];
  usefulCommands: string[];
  generatedComponents: string[];
  lastTaskSummary: string;
};

const EMPTY_MEMORY: ProjectMemory = {
  architecture: [],
  dependencies: [],
  importantFiles: [],
  conventions: [],
  usefulCommands: [],
  generatedComponents: [],
  lastTaskSummary: ""
};

export async function readProjectMemory(): Promise<ProjectMemory> {
  try {
    return JSON.parse(await fs.readFile(MEMORY_PATH, "utf-8")) as ProjectMemory;
  } catch {
    return { ...EMPTY_MEMORY };
  }
}

export async function writeProjectMemory(memory: ProjectMemory) {
  await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true });
  await fs.writeFile(MEMORY_PATH, `${JSON.stringify(memory, null, 2)}\n`, "utf-8");
  return memory;
}

export async function rememberTask(state: TaskState) {
  const memory = await readProjectMemory();
  if (state.progress.explorer) {
    memory.architecture = unique([
      ...memory.architecture,
      state.progress.explorer
    ]).slice(-5);
  }
  memory.importantFiles = unique([
    ...memory.importantFiles,
    ...state.sources
      .filter((source) => source.kind === "repository")
      .map((source) => source.label)
  ]).slice(-20);
  memory.generatedComponents = unique([
    ...memory.generatedComponents,
    ...state.modifiedFiles.filter((file) => file.endsWith(".tsx"))
  ]).slice(-20);
  memory.usefulCommands = unique([
    ...memory.usefulCommands,
    ...state.commands.filter((item) => item.exitCode === 0).map((item) => item.command)
  ]).slice(-20);
  memory.lastTaskSummary = `${state.originalRequest} -> ${state.stage}. ${state.errors.join(" ")}`;
  return writeProjectMemory(memory);
}

function unique(values: string[]) {
  return [...new Set(values)];
}
