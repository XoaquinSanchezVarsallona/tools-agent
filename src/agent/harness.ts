import type {
  ResponseFunctionToolCall,
  ResponseInputItem
} from "openai/resources/responses/responses";
import { llm } from "../llm/client";
import { toolDefinitions } from "../toolsDefinition";
import { toolRegistry, ToolName } from "../tools/index";

const AGENT_INSTRUCTIONS = `
Sos un coding agent.
Tu objetivo es resolver tareas de programación usando tools.
No inventes contenido de archivos: usá read_file.
Antes de modificar código, entendé el proyecto.
Después de modificar código, intentá verificar con tests o comandos relevantes.
Cuando termines, explicá brevemente qué hiciste.
`.trim();

const SYSTEM_MODIFYING_TOOLS = new Set<ToolName>([
  "write_file",
  "run_command"
]);

type AgentOptions = {
  supervisionMode: boolean;
  confirmAction?: (message: string) => Promise<boolean>;
};

export async function runAgentTurn(
  userMessage: string,
  conversation: ResponseInputItem[],
  options: AgentOptions
) {
  addUserMessage(conversation, userMessage);
  let iterations = 0;

  while (true) {
    iterations++;

    const response = await createAgentResponse(conversation);
    appendResponseOutput(conversation, response.output);

    const toolCalls = findToolCalls(response.output);

    if (toolCalls.length === 0) {
      return buildFinalResult(response.output_text, iterations);
    }

    for (const toolCall of toolCalls) {
      await handleToolCall(toolCall, conversation, options);
    }
  }
}

async function createAgentResponse(conversation: ResponseInputItem[]) {
  return llm.responses.create({
    model: "gpt-5.2",
    instructions: AGENT_INSTRUCTIONS,
    input: conversation,
    tools: toolDefinitions
  });
}

async function handleToolCall(
  toolCall: ResponseFunctionToolCall,
  conversation: ResponseInputItem[],
  options: AgentOptions
) {
  const parsedCall = parseToolCall(toolCall);

  if (!parsedCall.ok) {
    appendToolOutput(conversation, toolCall.call_id, parsedCall.output);
    return;
  }

  const approved = await requestApproval(parsedCall.name, parsedCall.args, options);

  if (!approved) {
    appendToolOutput(conversation, toolCall.call_id, rejectedToolOutput());
    return;
  }

  const output = await executeTool(parsedCall.name, parsedCall.args);
  appendToolOutput(conversation, toolCall.call_id, output);
}

function parseToolCall(toolCall: ResponseFunctionToolCall) {
  const toolName = toolCall.name;

  if (!isToolName(toolName)) {
    return {
      ok: false as const,
      output: { error: `Tool desconocida: ${toolName}` }
    };
  }

  try {
    return {
      ok: true as const,
      name: toolName,
      args: JSON.parse(toolCall.arguments || "{}") as unknown
    };
  } catch (error: unknown) {
    return {
      ok: false as const,
      output: { error: `Argumentos inválidos: ${formatError(error)}` }
    };
  }
}

async function executeTool(toolName: ToolName, args: unknown) {
  try {
    return await toolRegistry[toolName](args as never);
  } catch (error: unknown) {
    return { error: formatError(error) };
  }
}

async function requestApproval(
  toolName: ToolName,
  args: unknown,
  options: AgentOptions
) {
  if (!shouldRequestApproval(toolName, options)) {
    return true;
  }

  const message = `El agente quiere ejecutar ${toolName} con args: ${JSON.stringify(
    args,
    null,
    2
  )}`;

  return Boolean(await options.confirmAction?.(message));
}

function shouldRequestApproval(toolName: ToolName, options: AgentOptions) {
  return options.supervisionMode && SYSTEM_MODIFYING_TOOLS.has(toolName);
}

function isToolName(name: string): name is ToolName {
  return name in toolRegistry;
}

function findToolCalls(output: unknown[]) {
  return output.filter(
    (item): item is ResponseFunctionToolCall =>
      isResponseItem(item) && item.type === "function_call"
  );
}

function appendResponseOutput(conversation: ResponseInputItem[], output: unknown[]) {
  conversation.push(...(output as ResponseInputItem[]));
}

function appendToolOutput(
  conversation: ResponseInputItem[],
  callId: string,
  output: unknown
) {
  conversation.push({
    type: "function_call_output",
    call_id: callId,
    output: JSON.stringify(output)
  });
}

function addUserMessage(conversation: ResponseInputItem[], userMessage: string) {
  conversation.push({
    role: "user",
    content: userMessage
  });
}

function buildFinalResult(finalText: string, iterations: number) {
  return { finalText, iterations };
}

function rejectedToolOutput() {
  return {
    rejected: true,
    message: "El usuario rechazó esta acción."
  };
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isResponseItem(item: unknown): item is { type: string } {
  return typeof item === "object" && item !== null && "type" in item;
}
