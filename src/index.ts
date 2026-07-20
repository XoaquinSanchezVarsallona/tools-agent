import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import {
  type AgentMode,
  resolveUserIntent,
  runAgentTurn
} from "./agent/harness";
import { shutdownLangfuse, startLangfuse } from "./componentAgent/instrumentation";

const rl = readline.createInterface({ input, output });
const conversation: ResponseInputItem[] = [];
const state = {
  mode: "normal" as AgentMode,
  supervisionMode: true,
  lastPlan: undefined as string | undefined
};

type CommandResult = "handled" | "exit" | "not-command";

async function confirmAction(message: string) {
  console.log(`\n${message}`);
  const answer = await rl.question("Permitir? [y/n]: ");
  return answer.toLowerCase().trim() === "y";
}

function handleCommand(userInput: string): CommandResult {
  switch (userInput.trim()) {
    case "/exit":
      return "exit";
    case "/plan on":
      state.mode = "planning";
      state.lastPlan = undefined;
      console.log("Plan mode activado.");
      return "handled";
    case "/plan off":
      state.mode = "normal";
      state.lastPlan = undefined;
      console.log("Plan mode desactivado.");
      return "handled";
    case "/supervision on":
      state.supervisionMode = true;
      console.log("Supervision activada.");
      return "handled";
    case "/supervision off":
      state.supervisionMode = false;
      console.log("Supervision desactivada.");
      return "handled";
    default:
      return "not-command";
  }
}

async function main() {
  startLangfuse();

  try {
    while (true) {
      const userInput = await rl.question("\nUsuario: ");
      const commandResult = handleCommand(userInput);
      if (commandResult === "exit") break;
      if (commandResult === "handled") continue;

      const intent = await resolveUserIntent(userInput, state.mode, state.lastPlan);
      const executeLastPlan =
        state.mode === "planning" && intent.action === "implement";

      const turnMode: AgentMode = executeLastPlan ? "normal" : state.mode;
      const result = await runAgentTurn(userInput, conversation, {
        mode: turnMode,
        supervisionMode: state.supervisionMode,
        confirmAction,
        planContext: state.lastPlan,
        intent
      });

      if (turnMode === "planning") {
        state.lastPlan = result.finalText;
      } else if (executeLastPlan) {
        state.mode = "normal";
        state.lastPlan = undefined;
      }

      console.log(`\n${result.finalText}`);
    }
  } finally {
    rl.close();
    await shutdownLangfuse();
  }
}

main().catch((error: unknown) => {
  console.error("Error fatal:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
