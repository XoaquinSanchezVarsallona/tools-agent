import { llm } from "../llm/client";

const DEFAULT_MODEL = "text-embedding-3-small";

export async function embedTexts(texts: string[], model: string = DEFAULT_MODEL): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await llm.embeddings.create({
        model,
        input: texts
    });

    return response.data.map((d) => d.embedding);
}

export async function embedText(text: string, model?: string): Promise<number[]> {
    const [embedding] = await embedTexts([text], model);
    return embedding;
}