import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { type AgentMode, runAgentTurn } from "./agent/harness";
import { shutdownLangfuse, startLangfuse } from "./componentAgent/instrumentation";

const rl = readline.createInterface({ input, output });
const conversation: ResponseInputItem[] = [];
const state = { mode: "normal" as AgentMode, supervisionMode: true };

type CommandResult = "handled" | "exit" | "not-command";

async function confirmAction(message: string) {
  console.log("\nAccion supervisada:");
  console.log(message);
  const answer = await rl.question("Permitir? [y/n]: ");
  return answer.toLowerCase().trim() === "y";
}

function printHelp(langfuseEnabled: boolean) {
  console.log("Coding Agent Multiagente iniciado.");
  console.log(`Langfuse: ${langfuseEnabled ? "activado" : "desactivado"}`);
  console.log("Subagentes: Explorer -> Researcher -> Implementer -> Tester -> Reviewer");
  console.log("Comandos: /plan on, /plan off, /supervision on, /supervision off, /exit");
}

function handleCommand(userInput: string): CommandResult {
  switch (userInput.trim()) {
    case "/exit":
      return "exit";
    case "/plan on":
      state.mode = "planning";
      console.log("Plan mode activado.");
      return "handled";
    case "/plan off":
      state.mode = "normal";
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
  const langfuse = startLangfuse();
  printHelp(langfuse.enabled);

  try {
    while (true) {
      const userInput = await rl.question("\nUsuario: ");
      const commandResult = handleCommand(userInput);
      if (commandResult === "exit") break;
      if (commandResult === "handled") continue;

      const result = await runAgentTurn(userInput, conversation, {
        mode: state.mode,
        supervisionMode: state.supervisionMode,
        confirmAction
      });
      console.log("\nAgente:");
      console.log(result.finalText);
      console.log(`\nSubagentes ejecutados: ${result.iterations}`);
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
