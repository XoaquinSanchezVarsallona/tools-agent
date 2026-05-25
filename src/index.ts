import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runAgentTurn } from "./agent/harness";

const rl = readline.createInterface({ input, output });

const conversation: any[] = [];

type AgentMode = "normal" | "planning";
type CommandResult = "handled" | "exit" | "not-command";

const state = {
  mode: "normal" as AgentMode,
  supervisionMode: true
};

async function confirmAction(message: string): Promise<boolean> {
  console.log("\nAcción supervisada:");
  console.log(message);

  const answer = await rl.question("¿Permitir? [y/n]: ");
  return answer.toLowerCase().trim() === "y";
}

function printHelp() {
  console.log("Coding Agent iniciado.");
  console.log("Comandos:");
  console.log("/plan on");
  console.log("/plan off");
  console.log("/supervision on");
  console.log("/supervision off");
  console.log("/exit");
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
      console.log("Supervisión activada.");
      return "handled";

    case "/supervision off":
      state.supervisionMode = false;
      console.log("Supervisión desactivada.");
      return "handled";

    default:
      return "not-command";
  }
}

function buildPlanPrompt(userInput: string) {
  return `
PLAN MODE ACTIVADO.

Antes de ejecutar cualquier tool, primero respondé únicamente con un plan numerado de pasos.
No ejecutes tools todavía.
La tarea del usuario es:

${userInput}
  `.trim();
}

function buildApprovedPlanPrompt(userInput: string) {
  return `
El usuario aprobó el plan.
Ahora ejecutá la tarea usando las tools necesarias.

Tarea original:
${userInput}
  `.trim();
}

function buildModifiedPlanPrompt(modification: string) {
  return `
El usuario no aprobó el plan original.
Quiere esta modificación:

${modification}

Generá un nuevo plan o continuá según corresponda.
  `.trim();
}

async function runNormalTurn(userInput: string) {
  return runAgentTurn(userInput, conversation, {
    supervisionMode: state.supervisionMode,
    confirmAction
  });
}

async function runPlanningTurn(userInput: string) {
  const planResult = await runAgentTurn(buildPlanPrompt(userInput), conversation, {
    supervisionMode: false,
    confirmAction
  });

  console.log("\nAgente:");
  console.log(planResult.finalText);

  const approval = await rl.question("\n¿Aprobás el plan? [y/n/modificar]: ");

  switch (approval.toLowerCase().trim()) {
    case "y":
      return runNormalTurn(buildApprovedPlanPrompt(userInput));

    default: {
      const modification = await rl.question(
        "Indicá qué querés modificar del plan: "
      );

      return runNormalTurn(buildModifiedPlanPrompt(modification));
    }
  }
}

async function runTurn(userInput: string) {
  switch (state.mode) {
    case "planning":
      return runPlanningTurn(userInput);

    case "normal":
      return runNormalTurn(userInput);
  }
}

async function main() {
  printHelp();

  while (true) {
    const userInput = await rl.question("\nUsuario: ");
    const commandResult = handleCommand(userInput);

    if (commandResult === "exit") break;
    if (commandResult === "handled") continue;

    const result = await runTurn(userInput);

    console.log("\nAgente:");
    console.log(result.finalText);
    console.log(`\nIteraciones del loop interno: ${result.iterations}`);
  }

  rl.close();
}

main().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
