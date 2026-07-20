import fs from "node:fs";
import path from "node:path";
import { AgentConfig } from "../policies/config";

export interface SessionSummary {
    at: string;
    summary: string;
}

export interface ProjectMemory {
    architecture: string;
    conventions: string[];
    dependencies: string[];
    usefulCommands: string[];
    importantFiles: string[];
    decisions: string[];
    bugsInvestigated: string[];
    sessionSummaries: SessionSummary[];
    updatedAt: string;
}

export function emptyMemory(): ProjectMemory {
    return {
        architecture: "",
        conventions: [],
        dependencies: [],
        usefulCommands: [],
        importantFiles: [],
        decisions: [],
        bugsInvestigated: [],
        sessionSummaries: [],
        updatedAt: new Date().toISOString()
    };
}

function memoryFilePath(config: AgentConfig): string {
    return path.resolve(config.paths.memory, "memory.json");
}

export function loadProjectMemory(config: AgentConfig): ProjectMemory {
    const filePath = memoryFilePath(config);
    if (!fs.existsSync(filePath)) return emptyMemory();

    const raw = fs.readFileSync(filePath, "utf-8");
    if (!raw.trim()) return emptyMemory();

    try {
        return JSON.parse(raw) as ProjectMemory;
    } catch {
        return emptyMemory();
    }
}

export function saveProjectMemory(config: AgentConfig, memory: ProjectMemory): void {
    const filePath = memoryFilePath(config);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const toSave: ProjectMemory = { ...memory, updatedAt: new Date().toISOString() };
    fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), "utf-8");
}

export function hasSufficientMemory(memory: ProjectMemory): boolean {
    return memory.architecture.trim().length > 0 && memory.conventions.length > 0;
}

export function addDecision(memory: ProjectMemory, decision: string): ProjectMemory {
    return { ...memory, decisions: [...memory.decisions, decision] };
}

export function addBugInvestigated(memory: ProjectMemory, bug: string): ProjectMemory {
    return { ...memory, bugsInvestigated: [...memory.bugsInvestigated, bug] };
}

export function addSessionSummary(memory: ProjectMemory, summary: string): ProjectMemory {
    return {
        ...memory,
        sessionSummaries: [
            ...memory.sessionSummaries,
            { at: new Date().toISOString(), summary }
        ]
    };
}

export function summarizeMemoryForPrompt(memory: ProjectMemory): string {
    if (!hasSufficientMemory(memory)) {
        return "(no hay memoria previa del proyecto todavía)";
    }

    const lastSessions = memory.sessionSummaries
        .slice(-3)
        .map((s) => `- (${s.at}) ${s.summary}`)
        .join("\n");

    return `
Arquitectura conocida: ${memory.architecture}

Convenciones conocidas:
${memory.conventions.map((c) => `- ${c}`).join("\n")}

Dependencias conocidas: ${memory.dependencies.join(", ") || "(ninguna registrada)"}

Comandos útiles conocidos: ${memory.usefulCommands.join(", ") || "(ninguno registrado)"}

Archivos importantes conocidos:
${memory.importantFiles.map((f) => `- ${f}`).join("\n") || "(ninguno registrado)"}

Últimas sesiones:
${lastSessions || "(sin sesiones previas registradas)"}
`.trim();
}