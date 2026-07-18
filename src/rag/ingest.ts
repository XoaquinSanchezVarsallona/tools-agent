import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import * as cheerio from "cheerio";
import { chunkMarkdown } from "./chunk";
import { embedTexts } from "./embeddings";
import { VectorStore } from "./store";
import { loadAgentConfig } from "../policies/config";

interface RagSource {
    type: "file" | "url";
    value: string;
}

function loadSources(): RagSource[] {
    const sourcesPath = path.resolve("rag.sources.json");
    const raw = fs.readFileSync(sourcesPath, "utf-8");
    return JSON.parse(raw) as RagSource[];
}

async function fetchUrlAsText(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; tools-agent-rag-ingest/1.0)" }
    });

    if (!response.ok) {
        throw new Error(`No se pudo descargar ${url}: status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header").remove();

    // Extracción simple de texto plano. No es markdown real, pero el chunker
    // por headings sigue funcionando (todo el texto cae en una sola sección).
    return $("body").text().replace(/\n{3,}/g, "\n\n").trim();
}

async function ingest(): Promise<void> {
    const config = loadAgentConfig(path.resolve("agent.config.json"));
    const store = new VectorStore(path.resolve(config.paths.rag));
    const sources = loadSources();

    console.log(`Encontradas ${sources.length} fuente(s) en rag.sources.json`);

    for (const source of sources) {
        let rawContent: string;

        if (source.type === "file") {
            rawContent = fs.readFileSync(path.resolve(source.value), "utf-8");
        } else {
            console.log(`  Descargando ${source.value}...`);
            rawContent = await fetchUrlAsText(source.value);
        }

        const chunks = chunkMarkdown(source.value, rawContent);
        console.log(`  ${source.value}: ${chunks.length} chunk(s)`);

        store.clearSource(source.value);
        const embeddings = await embedTexts(
            chunks.map((c) => c.content),
            config.embeddingModel
        );
        store.insertChunks(chunks, embeddings);
    }

    console.log(`Ingesta completa. Total de chunks en el store: ${store.countChunks()}`);
    store.close();
}

ingest().catch((error) => {
    console.error("Error durante la ingesta:", error);
    process.exit(1);
});