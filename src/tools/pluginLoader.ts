import fs from "node:fs";
import path from "node:path";
import { ToolPlugin } from "./pluginTypes";

const PLUGINS_DIR = path.resolve(__dirname, "plugins");

export function discoverPlugins(): Map<string, ToolPlugin> {
    const registry = new Map<string, ToolPlugin>();

    if (!fs.existsSync(PLUGINS_DIR)) return registry;

    const files = fs
        .readdirSync(PLUGINS_DIR)
        .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"));

    for (const file of files) {
        const fullPath = path.join(PLUGINS_DIR, file);

        let mod: unknown;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            mod = require(fullPath);
        } catch (error) {
            console.warn(`[pluginLoader] No se pudo cargar ${file}:`, error);
            continue;
        }

        const plugin = (mod as { default?: unknown; plugin?: unknown }).default
            ?? (mod as { default?: unknown; plugin?: unknown }).plugin;

        if (!isValidPlugin(plugin)) {
            console.warn(
                `[pluginLoader] Se ignoró ${file}: no exporta un ToolPlugin válido (export default o "plugin").`
            );
            continue;
        }

        if (registry.has(plugin.name)) {
            console.warn(`[pluginLoader] Tool duplicada "${plugin.name}" en ${file}, se ignora.`);
            continue;
        }

        registry.set(plugin.name, plugin);
    }

    return registry;
}

function isValidPlugin(plugin: unknown): plugin is ToolPlugin {
    if (typeof plugin !== "object" || plugin === null) return false;
    const p = plugin as Partial<ToolPlugin>;
    return (
        typeof p.name === "string" &&
        typeof p.description === "string" &&
        typeof p.parameters === "object" &&
        p.parameters !== null &&
        typeof p.execute === "function"
    );
}