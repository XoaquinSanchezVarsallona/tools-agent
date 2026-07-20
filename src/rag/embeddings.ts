import { llm } from "../llm/client";
import { getTelemetry, type Telemetry, type TelemetryUsage } from "../observability/telemetry";

const DEFAULT_MODEL = "text-embedding-3-small";

export async function embedTexts(
    texts: string[],
    model: string = DEFAULT_MODEL,
    telemetry: Telemetry = getTelemetry(false)
): Promise<number[][]> {
    if (texts.length === 0) return [];

    return telemetry.observe("llm.embedding", "embedding", {
        model,
        input: { texts, count: texts.length }
    }, async (observation) => {
        const response = await llm.embeddings.create({ model, input: texts });
        const usage: TelemetryUsage = {
            input: response.usage.prompt_tokens,
            output: 0,
            total: response.usage.total_tokens
        };
        const total = telemetry.estimateCost(usage, "embedding");
        observation.update({
            output: { vectorCount: response.data.length, dimensions: response.data[0]?.embedding.length ?? 0 },
            usageDetails: usage,
            costDetails: total === undefined ? undefined : { total }
        });
        return response.data.map((item) => item.embedding);
    });
}

export async function embedText(text: string, model?: string, telemetry?: Telemetry): Promise<number[]> {
    const [embedding] = await embedTexts([text], model, telemetry);
    return embedding;
}
