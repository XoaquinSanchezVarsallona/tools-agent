import path from "node:path"; import { createAgent } from "../agent/harness"; import { loadSources, readSourceManifest } from "../rag/sources";
async function main() { const root = process.cwd(); const agent = await createAgent(root, { supervisionMode: false }); const count = await agent.rag.index(await loadSources(root, await readSourceManifest(root))); console.log(`Se indexaron ${count} chunks en ${path.resolve(root, agent.config.paths.rag)}.`); }
main().catch((error) => { console.error(error); process.exitCode = 1; });
