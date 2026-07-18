import "dotenv/config";
import { loadAgentConfig } from "./policies/config";
import { createTaskState, summarizeForPrompt } from "./agent/taskState";
import { runExplorer } from "./subagents/explorer";
import { runResearcher } from "./subagents/researcher";

const WORKSPACE = process.env.AGENT_WORKSPACE ?? "./fixture-user-api";

async function main() {
    const config = loadAgentConfig("./agent.config.json");
    const taskState = createTaskState(
        "Agregá validación con Zod al endpoint de creación de usuarios y cubrila con node:test."
    );

    console.log("\n=== Corriendo Explorer ===");
    const explorerResult = await runExplorer(taskState, {
        config,
        workspace: WORKSPACE
    });
    console.log("\n--- Resultado del Explorer ---");
    console.log(explorerResult.summary);
    console.log(`\nFuentes consultadas: ${explorerResult.sources.length}`);
    explorerResult.sources.forEach((s) => console.log(`  - [${s.type}] ${s.ref}`));

    console.log("\n\n=== Corriendo Researcher (debería pegarle al RAG) ===");
    const researcherRagResult = await runResearcher(
        taskState,
        "¿Cómo valido el body de un request con Zod en un endpoint de Express?",
        { config }
    );
    console.log("\n--- Resultado del Researcher (RAG) ---");
    console.log(researcherRagResult.summary);
    console.log(`\nFuentes: ${researcherRagResult.sources.length}`);
    researcherRagResult.sources.forEach((s) => console.log(`  - [${s.type}] ${s.ref}`));

    console.log("\n\n=== Resumen final del TaskState ===");
    console.log(summarizeForPrompt(taskState));
}

main().catch((error) => {
    console.error("Error en la prueba:", error);
    process.exit(1);
});