import type { ToolCallLogEntry } from "../agent/harness";
import type { Source } from "../agent/taskState";

export function repositorySourcesFromToolLog(log: ToolCallLogEntry[]): Source[] {
    return log
        .filter((entry) =>
            (entry.tool === "read_file" || entry.tool === "list_files") && !entry.denied
        )
        .map((entry) => {
            const args = entry.args as { path?: string };
            return {
                type: "repository" as const,
                ref: args.path ?? "(path desconocido)",
                snippet: entry.outputSummary,
                retrievedAt: new Date().toISOString()
            };
        });
}

export function writtenFilesFromToolLog(log: ToolCallLogEntry[]): string[] {
    return [...new Set(
        log
            .filter((entry) =>
                entry.tool === "write_file"
                && !entry.denied
                && (entry.rawOutput as { success?: boolean }).success === true
            )
            .map((entry) => (entry.args as { path?: string }).path)
            .filter((path): path is string => Boolean(path))
    )];
}
