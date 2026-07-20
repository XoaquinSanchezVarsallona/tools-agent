import fs from "node:fs";
import path from "node:path";
import { DocChunk } from "./chunk";

export interface RetrievedChunk extends DocChunk {
    score: number;
}

interface StoredRecord extends DocChunk {
    embedding: number[];
}

export class VectorStore {
    private filePath: string;
    private records: StoredRecord[];

    constructor(filePath: string) {
        this.filePath = filePath;
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        this.records = this.load();
    }

    private load(): StoredRecord[] {
        if (!fs.existsSync(this.filePath)) return [];
        const raw = fs.readFileSync(this.filePath, "utf-8");
        if (!raw.trim()) return [];
        return JSON.parse(raw) as StoredRecord[];
    }

    private persist(): void {
        fs.writeFileSync(this.filePath, JSON.stringify(this.records, null, 2), "utf-8");
    }

    clearSource(source: string): void {
        this.records = this.records.filter((r) => r.source !== source);
        this.persist();
    }

    insertChunk(chunk: DocChunk, embedding: number[]): void {
        this.records.push({ ...chunk, embedding });
        this.persist();
    }

    /** Inserta varios chunks de una sola vez, escribiendo el archivo una única vez (más eficiente que insertChunk en loop). */
    insertChunks(chunks: DocChunk[], embeddings: number[][]): void {
        chunks.forEach((chunk, i) => {
            this.records.push({ ...chunk, embedding: embeddings[i] });
        });
        this.persist();
    }

    countChunks(): number {
        return this.records.length;
    }

    search(queryEmbedding: number[], topK: number, minScore: number): RetrievedChunk[] {
        const scored = this.records.map((r) => ({
            source: r.source,
            heading: r.heading,
            chunkIndex: r.chunkIndex,
            content: r.content,
            score: cosineSimilarity(queryEmbedding, r.embedding)
        }));

        return scored
            .filter((r) => r.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    close(): void {
        // no-op: el store JSON no mantiene conexiones abiertas
    }
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}