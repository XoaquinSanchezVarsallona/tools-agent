import "dotenv/config";
import { loadAgentConfig } from "./policies/config";
import { createTaskState, summarizeForPrompt } from "./agent/taskState";
import { runExplorer } from "./subagents/explorer";
import { runResearcher } from "./subagents/researcher";
import { runImplementer } from "./subagents/implementer";
import { runTester } from "./subagents/tester";
import { runReviewer } from "./subagents/reviewer";
import { getTelemetry } from "./observability/telemetry";

const WORKSPACE = process.env.AGENT_WORKSPACE ?? "./fixture-user-api";

async function main() {
    const config = loadAgentConfig("./agent.config.json");
    const telemetry = getTelemetry(config.langfuse.enabled);
    const taskState = createTaskState(
        "Agregá validación con Zod al endpoint de creación de usuarios y cubrila con node:test."
    );

    console.log("\n=== Corriendo Explorer ===");
    const explorerResult = await runExplorer(taskState, {
        config,
        workspace: WORKSPACE,
        telemetry
    });
    console.log("\n--- Resultado del Explorer ---");
    console.log(explorerResult.summary);
    console.log(`\nFuentes consultadas: ${explorerResult.sources.length}`);
    explorerResult.sources.forEach((s) => console.log(`  - [${s.type}] ${s.ref}`));

    console.log("\n\n=== Corriendo Researcher (debería pegarle al RAG) ===");
    const researcherRagResult = await runResearcher(
        taskState,
        "¿Cómo valido el body de un request con Zod en un endpoint de Express?",
        { config, telemetry }
    );
    console.log("\n--- Resultado del Researcher (RAG) ---");
    console.log(researcherRagResult.summary);
    console.log(`\nFuentes: ${researcherRagResult.sources.length}`);
    researcherRagResult.sources.forEach((s) => console.log(`  - [${s.type}] ${s.ref}`));

    console.log("\n\n=== Corriendo Implementer ===");
    const implementerResult = await runImplementer(taskState, {
        config,
        workspace: WORKSPACE,
        telemetry,
        supervisionMode: true,
        confirmAction: async (message) => {
            console.log(`Acción omitida por el demo supervisado:\n${message}`);
            return false;
        }
    });
    console.log("\n--- Resultado del Implementer ---");
    console.log(implementerResult.summary);

    console.log("\n\n=== Corriendo Tester ===");
    const testerResult = await runTester(taskState, { config, workspace: WORKSPACE, telemetry });
    console.log("\n--- Resultado del Tester ---");
    console.log(testerResult.summary);

    console.log("\n\n=== Corriendo Reviewer ===");
    const reviewerResult = await runReviewer(taskState, { config, workspace: WORKSPACE, telemetry });
    console.log("\n--- Resultado del Reviewer ---");
    console.log(reviewerResult.summary);

    console.log("\n\n=== Resumen final del TaskState ===");
    console.log(summarizeForPrompt(taskState));
    await telemetry.flush();
}

main().catch((error) => {
    console.error("Error en la prueba:", error);
    process.exit(1);
});
