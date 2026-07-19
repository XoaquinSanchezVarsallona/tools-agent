import { AsyncLocalStorage } from "node:async_hooks";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import {
    startActiveObservation,
    type LangfuseObservation,
    type LangfuseObservationAttributes,
    type LangfuseObservationType
} from "@langfuse/tracing";
import { NodeSDK } from "@opentelemetry/sdk-node";

export type TelemetryObservationType = Exclude<LangfuseObservationType, "event">;

export interface TelemetryUsage {
    input: number;
    output: number;
    total: number;
}

export interface TelemetryData {
    input?: unknown;
    output?: unknown;
    metadata?: Record<string, unknown>;
    model?: string;
    usageDetails?: TelemetryUsage;
    costDetails?: { total: number };
    level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
    statusMessage?: string;
}

export interface TelemetryObservation {
    update(data: TelemetryData): void;
}

export interface CostRates {
    inputPerMillion?: number;
    outputPerMillion?: number;
    embeddingPerMillion?: number;
}

export interface Telemetry {
    observe<T>(
        name: string,
        type: TelemetryObservationType,
        data: TelemetryData,
        action: (observation: TelemetryObservation) => Promise<T>
    ): Promise<T>;
    estimateCost(usage: TelemetryUsage, type: "generation" | "embedding"): number | undefined;
    flush(): Promise<void>;
}

export interface MemoryObservation extends TelemetryData {
    name: string;
    type: TelemetryObservationType;
    startedAt: string;
    finishedAt?: string;
    latencyMs?: number;
    children: MemoryObservation[];
}

export class InMemoryTelemetry implements Telemetry {
    readonly traces: MemoryObservation[] = [];
    private readonly active = new AsyncLocalStorage<MemoryObservation>();

    constructor(private readonly rates: CostRates = {}) {}

    async observe<T>(
        name: string,
        type: TelemetryObservationType,
        data: TelemetryData,
        action: (observation: TelemetryObservation) => Promise<T>
    ): Promise<T> {
        const started = Date.now();
        const observation: MemoryObservation = {
            name,
            type,
            ...sanitizeData(data),
            startedAt: new Date(started).toISOString(),
            children: []
        };
        const parent = this.active.getStore();
        if (parent) parent.children.push(observation);
        else this.traces.push(observation);

        const handle: TelemetryObservation = {
            update: (update) => Object.assign(observation, sanitizeData(update))
        };

        try {
            return await this.active.run(observation, () => action(handle));
        } catch (error: unknown) {
            markError(handle, error);
            throw error;
        } finally {
            const finished = Date.now();
            observation.finishedAt = new Date(finished).toISOString();
            observation.latencyMs = finished - started;
        }
    }

    estimateCost(usage: TelemetryUsage, type: "generation" | "embedding") {
        return estimateCost(usage, type, this.rates);
    }

    async flush(): Promise<void> {}
}

class NoopTelemetry implements Telemetry {
    async observe<T>(
        _name: string,
        _type: TelemetryObservationType,
        _data: TelemetryData,
        action: (observation: TelemetryObservation) => Promise<T>
    ): Promise<T> {
        return action({ update: () => undefined });
    }

    estimateCost(): undefined {
        return undefined;
    }

    async flush(): Promise<void> {}
}

class LangfuseTelemetry implements Telemetry {
    constructor(
        private readonly processor: LangfuseSpanProcessor,
        private readonly rates: CostRates
    ) {}

    async observe<T>(
        name: string,
        type: TelemetryObservationType,
        data: TelemetryData,
        action: (observation: TelemetryObservation) => Promise<T>
    ): Promise<T> {
        const start = startActiveObservation as unknown as (
            observationName: string,
            callback: (observation: LangfuseObservation) => Promise<T>,
            options: { asType: TelemetryObservationType }
        ) => Promise<T>;

        let actionStarted = false;
        try {
            return await start(name, async (observation) => {
                actionStarted = true;
                safeUpdate(observation, data);
                const handle: TelemetryObservation = {
                    update: (update) => safeUpdate(observation, update)
                };
                try {
                    return await action(handle);
                } catch (error: unknown) {
                    markError(handle, error);
                    throw error;
                }
            }, { asType: type });
        } catch (error: unknown) {
            if (actionStarted) throw error;
            return action({ update: () => undefined });
        }
    }

    estimateCost(usage: TelemetryUsage, type: "generation" | "embedding") {
        return estimateCost(usage, type, this.rates);
    }

    async flush(): Promise<void> {
        try {
            await this.processor.forceFlush();
        } catch {
            // Observability must never fail an agent run.
        }
    }
}

export const noopTelemetry: Telemetry = new NoopTelemetry();

let defaultTelemetry: Telemetry | undefined;

export function getTelemetry(enabled: boolean): Telemetry {
    if (!enabled) return noopTelemetry;
    if (defaultTelemetry) return defaultTelemetry;
    if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
        return noopTelemetry;
    }

    try {
        const processor = new LangfuseSpanProcessor({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: process.env.LANGFUSE_SECRET_KEY,
            baseUrl: process.env.LANGFUSE_BASE_URL,
            exportMode: "batched"
        });
        const sdk = new NodeSDK({ spanProcessors: [processor] });
        sdk.start();
        defaultTelemetry = new LangfuseTelemetry(processor, ratesFromEnvironment());
    } catch (error: unknown) {
        console.warn(`Langfuse deshabilitado: ${errorMessage(error)}`);
        defaultTelemetry = noopTelemetry;
    }
    return defaultTelemetry;
}

function safeUpdate(observation: LangfuseObservation, data: TelemetryData): void {
    try {
        (observation as unknown as {
            update(attributes: LangfuseObservationAttributes): unknown;
        }).update(sanitizeData(data) as LangfuseObservationAttributes);
    } catch {
        // Observability must never fail an agent run.
    }
}

function markError(observation: TelemetryObservation, error: unknown): void {
    observation.update({
        level: "ERROR",
        statusMessage: errorMessage(error),
        metadata: { error: serializeError(error) }
    });
}

function sanitizeData(data: TelemetryData): TelemetryData {
    const sanitized = { ...data };
    if ("input" in data) sanitized.input = sanitizeValue(data.input);
    if ("output" in data) sanitized.output = sanitizeValue(data.output);
    if ("metadata" in data) {
        sanitized.metadata = sanitizeValue(data.metadata) as Record<string, unknown> | undefined;
    }
    return sanitized;
}

function sanitizeValue(value: unknown): unknown {
    if (value === undefined) return undefined;
    const sanitized = redact(value);
    const serialized = JSON.stringify(sanitized);
    if (!serialized || serialized.length <= 12_000) return sanitized;
    return { truncated: true, preview: serialized.slice(0, 12_000) };
}

function redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redact);
    if (typeof value !== "object" || value === null) return value;

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        /^(authorization|api[_-]?key|password|secret)$/i.test(key) ? "[REDACTED]" : redact(item)
    ]));
}

function serializeError(error: unknown) {
    return error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { message: String(error) };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function estimateCost(
    usage: TelemetryUsage,
    type: "generation" | "embedding",
    rates: CostRates
): number | undefined {
    if (type === "embedding") {
        return rates.embeddingPerMillion === undefined
            ? undefined
            : usage.input * rates.embeddingPerMillion / 1_000_000;
    }
    if (rates.inputPerMillion === undefined || rates.outputPerMillion === undefined) {
        return undefined;
    }
    return (
        usage.input * rates.inputPerMillion
        + usage.output * rates.outputPerMillion
    ) / 1_000_000;
}

function ratesFromEnvironment(): CostRates {
    return {
        inputPerMillion: numericEnvironment("LANGFUSE_INPUT_COST_PER_MILLION_USD"),
        outputPerMillion: numericEnvironment("LANGFUSE_OUTPUT_COST_PER_MILLION_USD"),
        embeddingPerMillion: numericEnvironment("LANGFUSE_EMBEDDING_COST_PER_MILLION_USD")
    };
}

function numericEnvironment(name: string): number | undefined {
    const value = process.env[name];
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
