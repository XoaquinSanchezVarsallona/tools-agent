import type {
  ResponseFunctionToolCall,
  ResponseInputItem
} from "openai/resources/responses/responses";
import { setActiveTraceIO, startActiveObservation } from "@langfuse/tracing";
import { loadAgentConfig, checkPolicy, type AgentConfig } from "./config";
import { readProjectMemory, rememberTask, saveLastRun } from "./memory";
import {
  createTaskState,
  summarizeState,
  type SubagentName,
  type TaskState
} from "./state";
import { getLlm, MODEL } from "../llm/client";
import { getToolDefinitions } from "../toolsDefinition";
import { toolRegistry, type ToolName } from "../tools";

export type AgentMode = "normal" | "planning";

export type UserIntent = {
  action: "answer" | "implement" | "keep_planning";
  reason: string;
};

type AgentOptions = {
  mode: AgentMode;
  supervisionMode: boolean;
  confirmAction?: (message: string) => Promise<boolean>;
  planContext?: string;
  intent: UserIntent;
};

type SubagentDefinition = {
  name: SubagentName;
  instructions: string;
  tools: readonly ToolName[];
};

const SUBAGENTS: Record<SubagentName, SubagentDefinition> = {
  explorer: {
    name: "explorer",
    tools: ["list_files", "read_file", "memory_read"],
    instructions: `Sos Explorer. Entende la estructura, dependencias, convenciones y archivos relevantes para el pedido. Usa las tools, no inventes contenido. Termina con un resumen breve de hallazgos.`
  },
  researcher: {
    name: "researcher",
    tools: ["rag_search", "web_search", "memory_read"],
    instructions: `Sos Researcher. Consulta obligatoriamente rag_search antes de decidir. Usa web_search solo si el resultado RAG dice sufficient=false. Distingue fuentes RAG, web y memoria. Termina listando evidencia y URLs.`
  },
  implementer: {
    name: "implementer",
    tools: ["read_file", "list_files", "write_file"],
    instructions: `Sos Implementer. Crea un componente React TypeScript aislado que satisfaga el pedido y use la evidencia disponible. Infiere un nombre PascalCase y escribe exactamente tres archivos bajo src/components/generated/{Nombre}/: {Nombre}.tsx, {Nombre}.css y {Nombre}.stories.tsx. No agregues dependencias. La story debe tener al menos tres variantes. Usa write_file y termina resumiendo los cambios.`
  },
  tester: {
    name: "tester",
    tools: ["run_command"],
    instructions: `Sos Tester. Valida el resultado ejecutando exactamente npm run typecheck y npm run build-storybook. No escribas tests ni modifiques archivos. Informa STATUS: PASS solo si ambos comandos terminan con exitCode 0; de lo contrario informa STATUS: FAIL y los errores concretos.`
  },
  reviewer: {
    name: "reviewer",
    tools: ["read_file"],
    instructions: `Sos Reviewer. Usa los hallazgos y lee archivos relevantes cuando sea necesario. Responde de forma directa, sin introducciones, repeticiones ni secciones innecesarias. Respeta estrictamente el formato y limite indicados para la tarea actual.`
  }
};

export async function resolveUserIntent(
  userMessage: string,
  mode: AgentMode,
  lastPlan?: string
): Promise<UserIntent> {
  if (mode === "planning" && !lastPlan) {
    return {
      action: "keep_planning",
      reason: "Primer pedido del modo planificacion."
    };
  }

  return startActiveObservation(
    "agent-user-intent",
    async (observation) => {
      const input = { userMessage, mode, lastPlan };
      observation.update({ input } as any);

      try {
        const response = await getLlm().responses.create({
          model: MODEL,
          instructions: `Sos el agente principal y enrutas el pedido. En modo normal, usa answer para consultas que solo requieren informacion y implement cuando el usuario pide crear o modificar codigo. En modo planning con un plan anterior, usa implement solo si autoriza ejecutar ese plan ahora; usa keep_planning para preguntas, ajustes, negativas o ambiguedad. No ejecutes tools.`,
          input: JSON.stringify(input),
          text: {
            format: {
              type: "json_schema",
              name: "user_intent",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  action: {
                    type: "string",
                    enum: ["answer", "implement", "keep_planning"]
                  },
                  reason: { type: "string" }
                },
                required: ["action", "reason"],
                additionalProperties: false
              }
            }
          }
        });
        const decision = JSON.parse(response.output_text) as UserIntent;

        if (
          (decision.action !== "answer" &&
            decision.action !== "implement" &&
            decision.action !== "keep_planning") ||
          typeof decision.reason !== "string"
        ) {
          throw new Error("Invalid user intent response");
        }

        const normalizedDecision: UserIntent = {
          ...decision,
          action:
            mode === "planning" && decision.action === "answer"
              ? "keep_planning"
              : mode === "normal" && decision.action === "keep_planning"
                ? "answer"
                : decision.action
        };
        observation.update({ output: normalizedDecision } as any);
        return normalizedDecision;
      } catch (error: unknown) {
        const fallback: UserIntent = {
          action: mode === "planning" ? "keep_planning" : "answer",
          reason: "No se pudo clasificar el pedido; se eligio la opcion sin escritura."
        };
        observation.update({
          level: "ERROR",
          statusMessage: error instanceof Error ? error.message : String(error),
          output: fallback
        } as any);
        return fallback;
      }
    },
    { asType: "agent" }
  );
}

export async function runAgentTurn(
  userMessage: string,
  conversation: ResponseInputItem[],
  options: AgentOptions
) {
  const config = await loadAgentConfig();
  const state = createTaskState(userMessage);
  state.intent = options.intent;
  const memory = await readProjectMemory();
  state.sources.push({ kind: "memory", label: "Project memory" });
  const repeatedCalls = new Map<string, number>();

  const finalText = await startActiveObservation(
    "coding-agent-task",
    async (task) => {
      task.update({ input: { request: userMessage }, metadata: { model: MODEL } } as any);
      setActiveTraceIO({ input: { request: userMessage } });

      await runStage("explorer");
      await runStage("researcher");

      if (options.mode === "planning") {
        const plan = await runStage(
          "reviewer",
          "Estas en modo planificacion. Propone un plan concreto de no mas de seis puntos breves. No incluyas STATUS ni detalles de trazabilidad."
        );
        state.stage = "done";
        state.sources.push({ kind: "inference", label: "Planning response", detail: plan });
        await saveLastRun(state);
        const result = cleanResponse(plan);
        task.update({ output: { result, state } } as any);
        setActiveTraceIO({ output: result });
        return result;
      }

      if (options.intent.action === "answer") {
        const answer = await runStage(
          "reviewer",
          "Responde directamente el pedido del usuario en un maximo de cuatro lineas. No propongas cambios, no incluyas STATUS y no describas el proceso interno."
        );
        state.stage = "done";
        state.sources.push({ kind: "inference", label: "Direct answer", detail: answer });
        await rememberTask(state);
        await saveLastRun(state);
        const result = cleanResponse(answer);
        task.update({ output: { result, state } } as any);
        setActiveTraceIO({ output: result });
        return result;
      }

      await runStage("implementer");
      const tester = await runStage("tester");
      const reviewer = await runStage(
        "reviewer",
        "Revisa la implementacion y las validaciones. Primera linea: STATUS: PASS o STATUS: NEEDS_CHANGES. Luego resume el resultado en no mas de cuatro lineas."
      );

      if (needsRepair(tester, reviewer, state)) {
        state.repairAttempted = true;
        await runStage("implementer", "Corregi solamente los errores informados por Tester o Reviewer. Este es el unico intento de reparacion.");
        const retryTester = await runStage("tester");
        const retryReviewer = await runStage(
          "reviewer",
          "Revisa la reparacion y las validaciones. Primera linea: STATUS: PASS o STATUS: NEEDS_CHANGES. Luego resume el resultado en no mas de cuatro lineas."
        );
        state.stage = needsRepair(retryTester, retryReviewer, state) ? "blocked" : "done";
      } else {
        state.stage = "done";
      }

      state.sources.push({
        kind: "inference",
        label: "Reviewer conclusion",
        detail: state.progress.reviewer
      });
      await rememberTask(state);
      await saveLastRun(state);
      const result = cleanResponse(state.progress.reviewer ?? reviewer);
      task.update({ output: { result, state }, metadata: { status: state.stage } } as any);
      setActiveTraceIO({ output: { result, state } });
      return result;

      async function runStage(name: SubagentName, extra = "") {
        state.stage = name;
        const definition = SUBAGENTS[name];
        const prompt = [
          `Pedido actual: ${state.originalRequest}`,
          options.planContext
            ? options.mode === "normal"
              ? `Plan aprobado por el usuario:\n${options.planContext}`
              : `Plan anterior para revisar o ajustar:\n${options.planContext}`
            : "",
          `Memoria del proyecto: ${JSON.stringify(memory)}`,
          `Estado compartido: ${summarizeState(state)}`,
          extra
        ].filter(Boolean).join("\n\n");

        const output = await startActiveObservation(
          `subagent-${name}`,
          async (observation) => {
            observation.update({ input: prompt } as any);
            const result = await runSubagent(
              definition,
              prompt,
              state,
              config,
              options,
              repeatedCalls
            );
            observation.update({ output: result } as any);
            return result;
          },
          { asType: "agent" }
        );
        state.progress[name] = output;
        return output;
      }

    },
    { asType: "agent" }
  );

  conversation.push({ role: "user", content: userMessage });
  conversation.push({ role: "assistant", content: finalText });
  if (conversation.length > 12) conversation.splice(0, conversation.length - 12);
  return { finalText, iterations: Object.keys(state.progress).length, state };
}

function cleanResponse(value: string) {
  return value
    .replace(/^STATUS:\s*(?:PASS|NEEDS_CHANGES|FAIL)\s*[-:—]?\s*/i, "")
    .trim();
}

async function runSubagent(
  definition: SubagentDefinition,
  prompt: string,
  state: TaskState,
  config: AgentConfig,
  options: AgentOptions,
  repeatedCalls: Map<string, number>
) {
  const input: ResponseInputItem[] = [{ role: "user", content: prompt }];

  for (let iteration = 0; iteration < 8; iteration++) {
    const response = await getLlm().responses.create({
      model: MODEL,
      instructions: definition.instructions,
      input,
      tools: getToolDefinitions(definition.tools)
    });
    input.push(...(response.output as ResponseInputItem[]));
    const calls = response.output.filter(
      (item): item is ResponseFunctionToolCall => item.type === "function_call"
    );
    if (calls.length === 0) return response.output_text;

    for (const call of calls) {
      const output = await handleToolCall(
        call,
        definition.tools,
        state,
        config,
        options,
        repeatedCalls
      );
      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(output)
      });
    }
  }

  state.errors.push(`${definition.name} excedio el limite de iteraciones`);
  return `STATUS: FAIL\n${definition.name} excedio el limite de iteraciones.`;
}

async function handleToolCall(
  call: ResponseFunctionToolCall,
  allowedTools: readonly ToolName[],
  state: TaskState,
  config: AgentConfig,
  options: AgentOptions,
  repeatedCalls: Map<string, number>
) {
  if (!(call.name in toolRegistry) || !allowedTools.includes(call.name as ToolName)) {
    return { error: `Tool no permitida: ${call.name}` };
  }

  let args: any;
  try {
    args = JSON.parse(call.arguments || "{}");
  } catch {
    return { error: "Argumentos JSON invalidos" };
  }

  const toolName = call.name as ToolName;
  const fingerprint = `${state.stage}:${state.repairAttempted}:${toolName}:${JSON.stringify(args)}`;
  const repetitions = (repeatedCalls.get(fingerprint) ?? 0) + 1;
  repeatedCalls.set(fingerprint, repetitions);
  if (repetitions >= 2) {
    const message = `Loop detenido: ${toolName} repitio la misma llamada sin avanzar.`;
    state.observations.push(message);
    return { error: message };
  }

  const policy = checkPolicy(config, toolName, args);
  if (!policy.allowed) {
    state.errors.push(policy.reason ?? "Tool denied by policy");
    return { error: policy.reason };
  }

  const modifying = toolName === "write_file" || toolName === "run_command" || toolName === "memory_write";
  if (policy.requiresApproval || (options.supervisionMode && modifying)) {
    const approved = await options.confirmAction?.(
      describeToolCall(toolName, args)
    );
    if (!approved) return { rejected: true, message: "El usuario rechazo la accion." };
  }

  try {
    const output = await startActiveObservation(
      `tool-${toolName}`,
      async (observation) => {
        observation.update({ input: args } as any);
        const result = await toolRegistry[toolName](args as never);
        observation.update({ output: result } as any);
        return result;
      },
      { asType: "tool" }
    );
    recordToolResult(toolName, args, output, state);
    return output;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    state.errors.push(`${toolName}: ${message}`);
    return { error: message };
  }
}

function describeToolCall(toolName: ToolName, args: any) {
  if (toolName === "run_command") {
    return `Accion supervisada: ${toolName} ${String(args.command ?? "")}`;
  }
  if ("path" in (args ?? {})) {
    return `Accion supervisada: ${toolName} ${String(args.path)}`;
  }
  return `Accion supervisada: ${toolName}`;
}

function recordToolResult(toolName: ToolName, args: any, output: any, state: TaskState) {
  if (toolName === "read_file" || toolName === "list_files") {
    state.sources.push({ kind: "repository", label: String(args.path) });
  }
  if (toolName === "memory_read") {
    state.sources.push({ kind: "memory", label: "Project memory" });
  }
  if (toolName === "rag_search") {
    for (const chunk of output.chunks ?? []) {
      state.sources.push({ kind: "rag", label: `${chunk.source}: ${chunk.section}`, url: chunk.url, detail: `score ${chunk.score}` });
    }
  }
  if (toolName === "web_search") {
    for (const source of output.sources ?? []) {
      state.sources.push({ kind: "web", label: source.title, url: source.url });
    }
  }
  if (toolName === "write_file") {
    state.modifiedFiles.push(String(args.path));
  }
  if (toolName === "run_command") {
    state.commands.push({ command: String(args.command), exitCode: Number(output.exitCode ?? 1) });
  }
}

function needsRepair(tester: string, reviewer: string, state: TaskState) {
  const latestCommands = state.commands.slice(-2);
  return (
    tester.includes("STATUS: FAIL") ||
    reviewer.includes("STATUS: NEEDS_CHANGES") ||
    latestCommands.some((command) => command.exitCode !== 0)
  );
}
