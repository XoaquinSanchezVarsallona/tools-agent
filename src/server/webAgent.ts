import type { IncomingMessage, ServerResponse } from "node:http";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { resolveUserIntent, runAgentTurn, type AgentMode } from "../agent/harness";
import { startLangfuse } from "../observability";

const conversation: ResponseInputItem[] = [];
const sessionState = {
  mode: "normal" as AgentMode,
  lastPlan: undefined as string | undefined
};

let langfuseStarted = false;
let running = false;

export async function handleAgentRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  if (running) {
    respondJson(res, 429, { error: "El agente ya está procesando un pedido. Esperá a que termine." });
    return;
  }

  if (!langfuseStarted) {
    startLangfuse();
    langfuseStarted = true;
  }

  running = true;
  try {
    const body = await readBody(req);
    const message = String(JSON.parse(body || "{}").message ?? "").trim();

    if (!message) {
      respondJson(res, 400, { error: "Falta el campo 'message'" });
      return;
    }

    const intent = await resolveUserIntent(message, sessionState.mode, sessionState.lastPlan);
    const executeLastPlan = sessionState.mode === "planning" && intent.action === "implement";
    const turnMode: AgentMode = executeLastPlan ? "normal" : sessionState.mode;

    const result = await runAgentTurn(message, conversation, {
      mode: turnMode,
      supervisionMode: false,
      planContext: sessionState.lastPlan,
      intent,
      quickReturn: intent.action === "implement"
    });

    if (turnMode === "planning") {
      sessionState.lastPlan = result.finalText;
    } else if (executeLastPlan) {
      sessionState.mode = "normal";
      sessionState.lastPlan = undefined;
    }

    // Extract component name from modified files for quick Storybook link
    const componentName = result.state.modifiedFiles
      .find((f) => f.endsWith(".tsx") && f.includes("generated"))
      ?.match(/generated\/([^/]+)\//)?.[1];

    const storyboookUrl = componentName ? `http://localhost:6006/?path=/docs/generated-${componentName}--docs` : null;

    respondJson(res, 200, {
      reply: result.finalText,
      stage: result.state.stage,
      componentName,
      storybook: storyboookUrl
    });
  } catch (error: unknown) {
    respondJson(res, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    running = false;
  }
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function respondJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
