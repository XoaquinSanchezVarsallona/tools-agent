import { readFileTool } from "./readFile";
import { writeFileTool } from "./writeFile";
import { runCommandTool } from "./runCommand";
import { listFilesTool } from "./listFiles";
import { webSearchTool } from "./webSearch";
import { discoverPlugins } from "./pluginLoader";
import { ToolPlugin } from "./pluginTypes";

const builtInRegistry = {
    read_file: readFileTool,
    write_file: writeFileTool,
    list_files: listFilesTool,
    run_command: runCommandTool,
    web_search: webSearchTool
};

const discoveredPlugins = discoverPlugins();

const pluginExecutors: Record<string, (args: any) => Promise<unknown>> = {};
for (const [name, plugin] of discoveredPlugins) {
    pluginExecutors[name] = plugin.execute;
}

export const toolRegistry: Record<string, (args: any) => Promise<unknown>> = {
    ...builtInRegistry,
    ...pluginExecutors
};

export type ToolName = string;

export function getDiscoveredPlugins(): Map<string, ToolPlugin> {
    return discoveredPlugins;
}