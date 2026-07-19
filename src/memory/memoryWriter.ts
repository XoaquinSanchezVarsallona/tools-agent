import type { ResponseInputItem } from "openai/resources/responses/responses";
import { runAgentTurn } from "../agent/harness";
import { AgentConfig } from "../policies/config";
import { TaskState, addObservation, logProgress } from "../agent/taskState";
import { ProjectMemory, loadProjectMemory, saveProjectMemory } from "./projectMemory";

interface MemorySynthesisOutput {
    architecture: string;
    conventions: string[];
    dependencies: string[];
    usefulCommands: string[];
    importantFiles: string[];
}

export async function updateProjectMemory(
    taskState: TaskState,
    explorerSummary: string,
    config: AgentConfig
): Promise<ProjectMemory> {
    const previousMemory = loadProjectMemory(config);

    const prompt = `
Memoria previa del proyecto (JSON):
${JSON.stringify(previousMemory, null, 2)}

Hallazgos nuevos del Explorer:
${explorerSummary}
  `.trim();

    const conversation: ResponseInputItem[] = [];

    try {
        const turnResult = await runAgentTurn(prompt, conversation, {
            mode: "memory_synthesis",
            config,
            supervisionMode: false
        });

        const parsed = parseMemorySynthesis(turnResult.finalText);

        const updatedMemory: ProjectMemory = {
            ...previousMemory,
            architecture: parsed.architecture,
            conventions: parsed.conventions,
            dependencies: parsed.dependencies,
            usefulCommands: parsed.usefulCommands,
            importantFiles: parsed.importantFiles
        };

        saveProjectMemory(config, updatedMemory);
        logProgress(
            taskState,
            `Memoria del proyecto actualizada: ${updatedMemory.conventions.length} convención(es), ${updatedMemory.usefulCommands.length} comando(s) útil(es) registrados.`
        );

        return updatedMemory;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addObservation(
            taskState,
            `No se pudo actualizar la memoria del proyecto: ${message}. Se conserva la memoria previa.`,
            "warning"
        );
        return previousMemory;
    }
}

function parseMemorySynthesis(rawText: string): MemorySynthesisOutput {
    const cleaned = rawText.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned) as Partial<MemorySynthesisOutput>;

    return {
        architecture: parsed.architecture ?? "",
        conventions: parsed.conventions ?? [],
        dependencies: parsed.dependencies ?? [],
        usefulCommands: parsed.usefulCommands ?? [],
        importantFiles: parsed.importantFiles ?? []
    };
}