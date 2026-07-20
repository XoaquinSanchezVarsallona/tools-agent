import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { loadAgentConfig } from "./policies/config";
import { runOrchestratedTurn } from "./agent/orchestrator";
import { getTelemetry } from "./observability/telemetry";
import type { TaskState } from "./agent/taskState";

const WORKSPACE = process.env.AGENT_WORKSPACE ?? "./fixture-user-api";
const EVIDENCE_DIR = path.resolve("docs/evidence");

async function main() {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const config = loadAgentConfig("./agent.config.json");
    const telemetry = getTelemetry(config.langfuse.enabled);

    const pedido =
        "Agregá validación con Zod al endpoint de creación de usuarios y cubrila con node:test. " +
        "Consultá la documentación indexada antes de implementar. Si agregás una dependencia nueva, " +
        "acordate de correr npm install para instalarla de verdad antes de correr los tests.";

    const result = await runOrchestratedTurn(pedido, [], {
        config,
        workspace: WORKSPACE,
        supervisionMode: true,
        telemetry,
        confirmAction: async (message) => {
            console.log(`[auto-aprobado para la demo] ${message}`);
            return true;
        },
        onProgress: (stage, message) => console.log(`  [${stage}] ${message}`)
    });

    const state: TaskState = result.taskState;
    console.log(`\nEstado final: ${state.status}`);
    console.log(`Archivos modificados: ${state.filesModified.join(", ") || "(ninguno)"}`);
    console.log(`\nRespuesta final:\n${result.finalText}`);

    await telemetry.flush();
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});