import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
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

    await runTarea1(config, telemetry);
    await runTarea2(config, telemetry);
    await runTarea3(config, telemetry);

    await telemetry.flush();
    console.log("\nListo. Evidencia guardada en docs/evidence/*.md");
}

async function runTarea1(config: ReturnType<typeof loadAgentConfig>, telemetry: ReturnType<typeof getTelemetry>) {
    console.log("\n=== TAREA 1: RAG + modificación verificable ===");
    const pedido =
        "Agregá validación con Zod al endpoint de creación de usuarios y cubrila con node:test. " +
        "Consultá la documentación indexada antes de implementar.";

    const result = await runOrchestratedTurn(pedido, [], {
        config,
        workspace: WORKSPACE,
        supervisionMode: true,
        telemetry,
        confirmAction: async (message) => {
            console.log(`[auto-aprobado para la demo] ${message}`);
            return true; // aprobamos npm install zod, write_file, run_command para esta corrida
        },
        onProgress: (stage, message) => console.log(`  [${stage}] ${message}`)
    });

    writeEvidence("tarea-1.md", "Tarea 1 — RAG y modificación verificable", pedido, result);
}

async function runTarea2(config: ReturnType<typeof loadAgentConfig>, telemetry: ReturnType<typeof getTelemetry>) {
    console.log("\n=== TAREA 2: Memoria del proyecto (sesión 1 de 2) ===");
    const pedido1 = "Analizá el repositorio y recordá su arquitectura, convenciones y comandos de validación.";

    const result1 = await runOrchestratedTurn(pedido1, [], {
        config,
        workspace: WORKSPACE,
        supervisionMode: false,
        telemetry,
        onProgress: (stage, message) => console.log(`  [${stage}] ${message}`)
    });
    writeEvidence("tarea-2-sesion-1.md", "Tarea 2 — Sesión 1 (explora y graba memoria)", pedido1, result1);

    console.log("\n=== TAREA 2: Memoria del proyecto (sesión 2 de 2, memoria ya existente) ===");
    const pedido2 =
        "Usando la memoria del proyecto, agregá una función chica siguiendo sus convenciones " +
        "y explicá qué recuerdos utilizaste.";

    const result2 = await runOrchestratedTurn(pedido2, [], {
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
    writeEvidence("tarea-2-sesion-2.md", "Tarea 2 — Sesión 2 (reutiliza memoria)", pedido2, result2);
}

async function runTarea3(config: ReturnType<typeof loadAgentConfig>, telemetry: ReturnType<typeof getTelemetry>) {
    console.log("\n=== TAREA 3: Cambio de estrategia / pedir ayuda ===");
    console.log(
        "Asegurate de haber activado el escenario roto antes de correr esto " +
        "(ver fixture-user-api/src/utils/logger.broken.ts.txt)."
    );

    const pedido = "Corregí el build, pero no modifiques package.json ni instales dependencias.";

    const result = await runOrchestratedTurn(pedido, [], {
        config,
        workspace: WORKSPACE,
        supervisionMode: true,
        telemetry,
        confirmAction: async (message) => {
            // Simulamos un usuario que NO autoriza instalar nada, para que el
            // agente se vea forzado a reconocer el bloqueo en vez de resolverlo.
            console.log(`[rechazado a propósito para la demo] ${message}`);
            return false;
        },
        onProgress: (stage, message) => console.log(`  [${stage}] ${message}`)
    });

    writeEvidence("tarea-3.md", "Tarea 3 — Cambio de estrategia / pedir ayuda", pedido, result);
}

function writeEvidence(
    fileName: string,
    title: string,
    pedido: string,
    result: Awaited<ReturnType<typeof runOrchestratedTurn>>
): void {
    const state: TaskState = result.taskState;

    const sourcesByType: Record<string, string[]> = {};
    for (const source of state.sourcesConsulted) {
        sourcesByType[source.type] ??= [];
        sourcesByType[source.type].push(source.ref);
    }

    const sourcesSection = Object.entries(sourcesByType)
        .map(([type, refs]) => `- **${type}**: ${refs.join(", ")}`)
        .join("\n") || "(sin fuentes registradas)";

    const observationsSection = state.observations
        .map((o) => `- (${o.severity}) ${o.message}`)
        .join("\n") || "(sin observaciones)";

    const content = `
# ${title}

- Fecha: ${new Date().toISOString()}
- Repositorio: fixture-user-api
- Pedido exacto: "${pedido}"

## Resultado

- Estado final de la tarea: **${state.status}**
- Subagentes usados: ${result.selectedSubagents.join(", ") || "(ninguno)"}
- Ciclo de reparación disparado: ${result.repairAttempted ? "sí" : "no"}
- Archivos modificados: ${state.filesModified.join(", ") || "(ninguno)"}

## Fuentes consultadas (repository / memory / rag / web / inference)

${sourcesSection}

## Observaciones registradas

${observationsSection}

## Respuesta final del orquestador

${result.finalText}

## Qué se observa

`.trim();

    fs.writeFileSync(path.join(EVIDENCE_DIR, fileName), content, "utf-8");
    console.log(`  -> Evidencia guardada en docs/evidence/${fileName}`);
}

main().catch((error) => {
    console.error("Error corriendo las tareas de evidencia:", error);
    process.exit(1);
});