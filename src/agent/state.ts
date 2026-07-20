export type SubagentName =
  | "explorer"
  | "researcher"
  | "implementer"
  | "tester"
  | "reviewer";

export type TaskSource = {
  kind: "repository" | "memory" | "rag" | "web" | "inference";
  label: string;
  url?: string;
  detail?: string;
};

export type TaskState = {
  id: string;
  originalRequest: string;
  intent: {
    action: "answer" | "implement" | "keep_planning";
    reason: string;
  };
  stage: SubagentName | "done" | "blocked";
  progress: Partial<Record<SubagentName, string>>;
  sources: TaskSource[];
  modifiedFiles: string[];
  commands: Array<{ command: string; exitCode: number }>;
  observations: string[];
  errors: string[];
  repairAttempted: boolean;
};

export function createTaskState(originalRequest: string): TaskState {
  return {
    id: `${Date.now()}`,
    originalRequest,
    intent: { action: "answer", reason: "Not classified yet" },
    stage: "explorer",
    progress: {},
    sources: [],
    modifiedFiles: [],
    commands: [],
    observations: [],
    errors: [],
    repairAttempted: false
  };
}

export function summarizeState(state: TaskState) {
  return JSON.stringify({
    originalRequest: state.originalRequest,
    intent: state.intent,
    progress: state.progress,
    sources: state.sources,
    modifiedFiles: state.modifiedFiles,
    commands: state.commands,
    errors: state.errors,
    repairAttempted: state.repairAttempted
  });
}
