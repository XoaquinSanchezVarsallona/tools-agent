import fs from "node:fs";
import path from "node:path";

export interface AgentConfig {
    model: string;
    embeddingModel: string;
    maxIterations: number;
    conversationWindow: number;
    paths: {
        memory: string;
        rag: string;
        tasks: string;
    };
    policies: {
        deniedRead: string[];
        deniedWrite: string[];
        deniedCommands: string[];
        approvalCommands: string[];
    };
    verificationCommands: string[];
    loopDetection: {
        repeatedActionLimit: number;
        replanLimit: number;
    };
    langfuse: {
        enabled: boolean;
    };
}

const DEFAULT_CONFIG: AgentConfig = {
    model: "gpt-5.2",
    embeddingModel: "text-embedding-3-small",
    maxIterations: 12,
    conversationWindow: 40,
    paths: {
        memory: ".agent-data/memory",
        rag: ".agent-data/rag/vectors.json",
        tasks: ".agent-data/tasks"
    },
    policies: {
        deniedRead: [],
        deniedWrite: [],
        deniedCommands: [],
        approvalCommands: []
    },
    verificationCommands: [],
    loopDetection: { repeatedActionLimit: 2, replanLimit: 1 },
    langfuse: { enabled: false }
};

export function loadAgentConfig(configPath: string): AgentConfig {
    const resolved = path.resolve(configPath);

    if (!fs.existsSync(resolved)) {
        throw new Error(`No se encontró el archivo de configuración en ${resolved}.`);
    }

    const raw = fs.readFileSync(resolved, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AgentConfig>;

    return validateAndMerge(parsed, resolved);
}

function validateAndMerge(parsed: Partial<AgentConfig>, sourcePath: string): AgentConfig {
    const errors: string[] = [];

    if (parsed.policies?.deniedRead && !Array.isArray(parsed.policies.deniedRead)) {
        errors.push("policies.deniedRead debe ser un array de strings.");
    }
    if (parsed.policies?.deniedWrite && !Array.isArray(parsed.policies.deniedWrite)) {
        errors.push("policies.deniedWrite debe ser un array de strings.");
    }
    if (parsed.policies?.deniedCommands && !Array.isArray(parsed.policies.deniedCommands)) {
        errors.push("policies.deniedCommands debe ser un array de strings.");
    }
    if (parsed.policies?.approvalCommands && !Array.isArray(parsed.policies.approvalCommands)) {
        errors.push("policies.approvalCommands debe ser un array de strings.");
    }

    if (errors.length > 0) {
        throw new Error(
            `Configuración inválida en ${sourcePath}:\n` + errors.map((e) => `  - ${e}`).join("\n")
        );
    }

    return {
        model: parsed.model ?? DEFAULT_CONFIG.model,
        embeddingModel: parsed.embeddingModel ?? DEFAULT_CONFIG.embeddingModel,
        maxIterations: parsed.maxIterations ?? DEFAULT_CONFIG.maxIterations,
        conversationWindow: parsed.conversationWindow ?? DEFAULT_CONFIG.conversationWindow,
        paths: {
            memory: parsed.paths?.memory ?? DEFAULT_CONFIG.paths.memory,
            rag: parsed.paths?.rag ?? DEFAULT_CONFIG.paths.rag,
            tasks: parsed.paths?.tasks ?? DEFAULT_CONFIG.paths.tasks
        },
        policies: {
            deniedRead: parsed.policies?.deniedRead ?? DEFAULT_CONFIG.policies.deniedRead,
            deniedWrite: parsed.policies?.deniedWrite ?? DEFAULT_CONFIG.policies.deniedWrite,
            deniedCommands: parsed.policies?.deniedCommands ?? DEFAULT_CONFIG.policies.deniedCommands,
            approvalCommands: parsed.policies?.approvalCommands ?? DEFAULT_CONFIG.policies.approvalCommands
        },
        verificationCommands: parsed.verificationCommands ?? DEFAULT_CONFIG.verificationCommands,
        loopDetection: {
            repeatedActionLimit:
                parsed.loopDetection?.repeatedActionLimit ?? DEFAULT_CONFIG.loopDetection.repeatedActionLimit,
            replanLimit: parsed.loopDetection?.replanLimit ?? DEFAULT_CONFIG.loopDetection.replanLimit
        },
        langfuse: {
            enabled: parsed.langfuse?.enabled ?? DEFAULT_CONFIG.langfuse.enabled
        }
    };
}