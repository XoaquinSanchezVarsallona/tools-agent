import type { ResponseInputItem } from "openai/resources/responses/responses";
import { llm } from "../llm/client";
import { AgentConfig } from "../policies/config";
import { getTelemetry, type Telemetry, type TelemetryUsage } from "../observability/telemetry";

const CONTEXT_SUMMARY_INSTRUCTIONS = `
Vas a recibir una transcripción de una conversación entre un coding agent y
sus tools (mensajes, llamadas a tools, y resultados de esas tools).

Resumila en un texto breve y denso que conserve:
- Qué se pidió originalmente.
- Qué decisiones importantes se tomaron y por qué.
- Qué archivos se leyeron o modificaron, y qué se encontró en ellos.
- Qué comandos se ejecutaron y con qué resultado.
- Cualquier error o bloqueo relevante que haya ocurrido.

No repitas contenido textual completo de archivos ni de outputs largos:
resumí su relevancia. No inventes nada que no esté en la transcripción.
Respondé solo con el resumen, sin preámbulo.
`.trim();

/**
 * Si la conversación supera el conversationWindow configurado, comprime los
 * mensajes más viejos en un único resumen (generado por LLM) y conserva los
 * más recientes tal cual. Muta el array en el lugar (mismo objeto de
 * referencia), así el caller no necesita reasignar nada.
 */
export async function compressConversationIfNeeded(
    conversation: ResponseInputItem[],
    config: AgentConfig,
    telemetry: Telemetry = getTelemetry(config.langfuse.enabled)
): Promise<boolean> {
    const window = config.conversationWindow;
    if (conversation.length <= window) return false;

    const keepRecentCount = Math.max(4, Math.floor(window / 2));
    const toSummarize = conversation.slice(0, conversation.length - keepRecentCount);
    const toKeep = conversation.slice(-keepRecentCount);

    const transcript = stringifyItems(toSummarize);
    const summaryText = await summarizeTranscript(transcript, config, telemetry);

    conversation.length = 0;
    conversation.push({
        role: "user",
        content: `[Resumen de contexto anterior, comprimido para no exceder la ventana de conversación]\n\n${summaryText}`
    });
    conversation.push(...toKeep);

    return true;
}

function stringifyItems(items: ResponseInputItem[]): string {
    return items
        .map((item) => {
            const asAny = item as unknown as Record<string, unknown>;            if (asAny.type === "function_call") {
                return `[llamada a tool] ${asAny.name}(${asAny.arguments})`;
            }
            if (asAny.type === "function_call_output") {
                const output = String(asAny.output ?? "");
                return `[resultado de tool] ${output.slice(0, 300)}`;
            }
            if (asAny.role && asAny.content) {
                return `[${asAny.role}] ${typeof asAny.content === "string" ? asAny.content : JSON.stringify(asAny.content)}`;
            }
            return `[item] ${JSON.stringify(item).slice(0, 200)}`;
        })
        .join("\n");
}

async function summarizeTranscript(
    transcript: string,
    config: AgentConfig,
    telemetry: Telemetry
): Promise<string> {
    return telemetry.observe("llm.context-summary", "generation", {
        model: config.model,
        input: { instructions: CONTEXT_SUMMARY_INSTRUCTIONS, transcript }
    }, async (observation) => {
        const response = await llm.responses.create({
            model: config.model,
            instructions: CONTEXT_SUMMARY_INSTRUCTIONS,
            input: [{ role: "user", content: transcript }],
            tools: []
        });
        const usage: TelemetryUsage | undefined = response.usage ? {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
            total: response.usage.total_tokens
        } : undefined;
        const total = usage ? telemetry.estimateCost(usage, "generation") : undefined;
        observation.update({
            output: response.output_text,
            usageDetails: usage,
            costDetails: total === undefined ? undefined : { total }
        });
        return response.output_text;
    });
}
