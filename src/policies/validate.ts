import { minimatch } from "minimatch";
import path from "node:path";
import { AgentConfig } from "./config";

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
            return checkReadPolicy(config, String(args.path ?? ""));
        case "write_file":
            return checkWritePolicy(config, String(args.path ?? ""));
        case "run_command":
            return checkCommandPolicy(config, String(args.command ?? ""));
        case "list_files":
            return checkReadPolicy(config, String(args.path ?? ""));
        default:
            return { allowed: true, requiresApproval: false };
    }
}

function checkReadPolicy(config: AgentConfig, targetPath: string): PolicyDecision {
    const denied = matchesAnyPattern(targetPath, config.permissions.read.deny);
    if (denied) {
        return {
            allowed: false,
            requiresApproval: false,
            reason: `Lectura denegada por política: "${targetPath}" matchea un patrón prohibido (${denied}).`
        };
    }
    return { allowed: true, requiresApproval: false };
}

function checkWritePolicy(config: AgentConfig, targetPath: string): PolicyDecision {
    const denied = matchesAnyPattern(targetPath, config.permissions.write.deny);
    if (denied) {
        return {
            allowed: false,
            requiresApproval: false,
            reason: `Escritura denegada por política: "${targetPath}" matchea un patrón prohibido (${denied}).`
        };
    }
    return { allowed: true, requiresApproval: false };
}

function checkCommandPolicy(config: AgentConfig, command: string): PolicyDecision {
    const deniedMatch = config.commands.deny.find((pattern) => command.includes(pattern));
    if (deniedMatch) {
        return {
            allowed: false,
            requiresApproval: false,
            reason: `Comando denegado por política: "${command}" contiene "${deniedMatch}".`
        };
    }

    const approvalMatch = config.commands.require_approval.find((pattern) =>
        command.includes(pattern)
    );
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