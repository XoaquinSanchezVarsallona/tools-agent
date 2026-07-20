import { minimatch } from "minimatch";
import path from "node:path";
import { AgentConfig } from "./config";
import { getDiscoveredPlugins } from "../tools/index";

export type PolicyDecision =
    | { allowed: true; requiresApproval: false }
    | { allowed: true; requiresApproval: true; reason: string }
    | { allowed: false; requiresApproval: false; reason: string };

export function validateToolCall(
    config: AgentConfig,
    toolName: string,
    args: Record<string, unknown>
): PolicyDecision {
    switch (toolName) {
        case "read_file":
        case "list_files":
            return checkReadPolicy(config, String(args.path ?? ""));
        case "write_file":
            return checkWritePolicy(config, String(args.path ?? ""));
        case "run_command":
            return checkCommandPolicy(config, String(args.command ?? ""));
        default:
            return checkPluginPolicy(toolName);
    }
}

function checkPluginPolicy(toolName: string): PolicyDecision {
    const plugin = getDiscoveredPlugins().get(toolName);
    if (plugin?.policy?.requiresApproval) {
        return {
            allowed: true,
            requiresApproval: true,
            reason: `La tool "${toolName}" está marcada por su plugin como que requiere aprobación.`
        };
    }
    return { allowed: true, requiresApproval: false };
}

function checkReadPolicy(config: AgentConfig, targetPath: string): PolicyDecision {
    const denied = matchesAnyPattern(targetPath, config.policies.deniedRead);
    if (denied) {
        return {
            allowed: false,
            requiresApproval: false,
            reason: `Lectura denegada por política: "${targetPath}" matchea "${denied}".`
        };
    }
    return { allowed: true, requiresApproval: false };
}

function checkWritePolicy(config: AgentConfig, targetPath: string): PolicyDecision {
    const denied = matchesAnyPattern(targetPath, config.policies.deniedWrite);
    if (denied) {
        return {
            allowed: false,
            requiresApproval: false,
            reason: `Escritura denegada por política: "${targetPath}" matchea "${denied}".`
        };
    }
    return { allowed: true, requiresApproval: false };
}

function checkCommandPolicy(config: AgentConfig, command: string): PolicyDecision {
    const deniedMatch = config.policies.deniedCommands.find((pattern) => command.includes(pattern));
    if (deniedMatch) {
        return {
            allowed: false,
            requiresApproval: false,
            reason: `Comando denegado por política: "${command}" contiene "${deniedMatch}".`
        };
    }

    const approvalMatch = config.policies.approvalCommands.find((pattern) => command.includes(pattern));
    if (approvalMatch) {
        return {
            allowed: true,
            requiresApproval: true,
            reason: `El comando "${command}" contiene "${approvalMatch}", que requiere aprobación explícita.`
        };
    }

    return { allowed: true, requiresApproval: false };
}

function matchesAnyPattern(targetPath: string, patterns: string[]): string | null {
    if (!targetPath) return null;
    const normalized = normalizeForMatch(targetPath);

    for (const pattern of patterns) {
        if (minimatch(normalized, pattern, { dot: true }) || normalized.includes(pattern)) {
            return pattern;
        }
    }
    return null;
}

function normalizeForMatch(targetPath: string): string {
    return path.normalize(targetPath).replace(/\\/g, "/").replace(/^\.\//, "");
}