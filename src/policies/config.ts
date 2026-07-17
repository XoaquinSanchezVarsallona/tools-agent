import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export interface AgentConfig {
    workspace: string;
    permissions: {
        read: { deny: string[] };
        write: { deny: string[] };
    };
    commands: {
        deny: string[];
        require_approval: string[];
    };
    rag: {
        topK: number;
        minScore: number;
    };
    observability: {
        provider: string;
        enabled: boolean;
    };
}

const DEFAULT_CONFIG: AgentConfig = {
    workspace: ".",
    permissions: {
        read: { deny: [] },
        write: { deny: [] }
    },
    commands: {
        deny: [],
        require_approval: []
    },
    rag: { topK: 5, minScore: 0.5 },
    observability: { provider: "none", enabled: false }
};

export function loadAgentConfig(configPath: string): AgentConfig {
    const resolved = path.resolve(configPath);

    if (!fs.existsSync(resolved)) {
        throw new Error(
            `No se encontró el archivo de configuración en ${resolved}. ` +
            `Copiá agent.config.example.yaml a agent.config.yaml y ajustalo.`
        );
    }

    const raw = fs.readFileSync(resolved, "utf-8");
    const parsed = YAML.parse(raw) as Partial<AgentConfig>;

    return validateAndMerge(parsed, resolved);
}

function validateAndMerge(parsed: Partial<AgentConfig>, sourcePath: string): AgentConfig {
    const errors: string[] = [];

    if (parsed.workspace !== undefined && typeof parsed.workspace !== "string") {
        errors.push("workspace debe ser un string.");
    }

    if (parsed.permissions?.read?.deny && !Array.isArray(parsed.permissions.read.deny)) {
        errors.push("permissions.read.deny debe ser un array de strings.");
    }

    if (parsed.permissions?.write?.deny && !Array.isArray(parsed.permissions.write.deny)) {
        errors.push("permissions.write.deny debe ser un array de strings.");
    }

    if (parsed.commands?.deny && !Array.isArray(parsed.commands.deny)) {
        errors.push("commands.deny debe ser un array de strings.");
    }

    if (parsed.commands?.require_approval && !Array.isArray(parsed.commands.require_approval)) {
        errors.push("commands.require_approval debe ser un array de strings.");
    }

    if (errors.length > 0) {
        throw new Error(
            `Configuración inválida en ${sourcePath}:\n` + errors.map((e) => `  - ${e}`).join("\n")
        );
    }

    return {
        workspace: parsed.workspace ?? DEFAULT_CONFIG.workspace,
        permissions: {
            read: { deny: parsed.permissions?.read?.deny ?? DEFAULT_CONFIG.permissions.read.deny },
            write: { deny: parsed.permissions?.write?.deny ?? DEFAULT_CONFIG.permissions.write.deny }
        },
        commands: {
            deny: parsed.commands?.deny ?? DEFAULT_CONFIG.commands.deny,
            require_approval:
                parsed.commands?.require_approval ?? DEFAULT_CONFIG.commands.require_approval
        },
        rag: {
            topK: parsed.rag?.topK ?? DEFAULT_CONFIG.rag.topK,
            minScore: parsed.rag?.minScore ?? DEFAULT_CONFIG.rag.minScore
        },
        observability: {
            provider: parsed.observability?.provider ?? DEFAULT_CONFIG.observability.provider,
            enabled: parsed.observability?.enabled ?? DEFAULT_CONFIG.observability.enabled
        }
    };
}