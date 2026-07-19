import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { type AgentMode, runAgentTurn } from "./agent/harness";
import { type OperatingStyle, runOrchestratedTurn } from "./agent/orchestrator";
import { loadAgentConfig } from "./policies/config";
import type { ResponseInputItem } from "openai/resources/responses/responses";

const rl = readline.createInterface({ input, output });
const normalConversation: ResponseInputItem[] = [];
const orchestratorConversation: ResponseInputItem[] = [];
const config = loadAgentConfig(process.env.AGENT_CONFIG_PATH ?? "./agent.config.json");
const WORKSPACE = process.env.AGENT_WORKSPACE ?? "./fixture-user-api";

type CommandResult = "handled" | "exit" | "not-command";
const state = {
    mode: "normal" as AgentMode,
    operatingStyle: "normal" as OperatingStyle,
    supervisionMode: true
};

async function confirmAction(message: string): Promise<boolean> {
    console.log("\nAcción supervisada:");
    console.log(message);
    return (await rl.question("¿Permitir? [y/n]: ")).toLowerCase().trim() === "y";
}

function printHelp() {
    console.log("Coding Agent iniciado.");
    console.log(`Workspace: ${WORKSPACE}`);
    console.log(
        "Comandos:\n/orchestrator on\n/orchestrator off\n/plan on\n/plan off\n/supervision on\n/supervision off\n/exit"
    );
}

function handleCommand(userInput: string): CommandResult {
    switch (userInput.trim()) {
        case "/exit": return "exit";
        case "/orchestrator on":
            state.operatingStyle = "orchestrator";
            console.log("Modo Orchestrator activado.");
            return "handled";
        case "/orchestrator off":
            state.operatingStyle = "normal";
            console.log("Modo Orchestrator desactivado; modo normal activo.");
            return "handled";
        case "/plan on":
            if (state.operatingStyle === "orchestrator") {
                console.log("Plan mode solo está disponible en modo normal. Usá /orchestrator off primero.");
                return "handled";
            }
            state.mode = "planning";
            console.log("Plan mode activado.");
            return "handled";
        case "/plan off":
            if (state.operatingStyle === "orchestrator") {
                console.log("Plan mode solo está disponible en modo normal. Usá /orchestrator off primero.");
                return "handled";
            }
            state.mode = "normal";
            console.log("Plan mode desactivado.");
            return "handled";
        case "/supervision on": state.supervisionMode = true; console.log("Supervisión activada."); return "handled";
        case "/supervision off": state.supervisionMode = false; console.log("Supervisión desactivada."); return "handled";
        default: return "not-command";
    }
}

async function runTurn(userInput: string) {
    if (state.operatingStyle === "orchestrator") {
        return runOrchestratedTurn(userInput, orchestratorConversation, {
            config,
            workspace: WORKSPACE,
            supervisionMode: state.supervisionMode,
            confirmAction,
            onProgress: (stage, message) => console.log(`[${stage}] ${message}`)
        });
    }

    return runAgentTurn(userInput, normalConversation, {
        mode: state.mode,
        config,
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
        if ("iterations" in result) {
            console.log(`\nIteraciones del loop interno: ${result.iterations}`);
        }
    }
    rl.close();
}

main().catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
});
