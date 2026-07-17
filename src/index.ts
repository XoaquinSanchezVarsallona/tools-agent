import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AgentMode, runAgentTurn } from "./agent/harness";

const rl = readline.createInterface({ input, output });

const conversation: any[] = [];

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

async function runTurn(userInput: string) {
    return runAgentTurn(userInput, conversation, {
        mode: state.mode,
        supervisionMode: state.supervisionMode,
        confirmAction
    });
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