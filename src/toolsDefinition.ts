import type { FunctionTool } from "openai/resources/responses/responses";
import type { ToolName } from "./tools/index";
import { getDiscoveredPlugins } from "./tools/index";

const toolDefinitionsByName: Record<string, FunctionTool> = {
  read_file: {
    type: "function" as const,
    name: "read_file",
    description: "Lee el contenido de un archivo dado su path.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path relativo o absoluto del archivo a leer."
        }
      },
      required: ["path"],
      additionalProperties: false
    }
  },
  write_file: {
    type: "function" as const,
    name: "write_file",
    description: "Escribe contenido en un archivo, reemplazando su contenido actual.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path del archivo a escribir."
        },
        content: {
          type: "string",
          description: "Nuevo contenido completo del archivo."
        }
      },
      required: ["path", "content"],
      additionalProperties: false
    }
  },
  list_files: {
    type: "function" as const,
    name: "list_files",
    description: "Lista archivos y carpetas dentro de un directorio.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directorio a listar."
        }
      },
      required: ["path"],
      additionalProperties: false
    }
  },
  run_command: {
    type: "function" as const,
    name: "run_command",
    description: "Ejecuta un comando de terminal y devuelve stdout y stderr.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Comando a ejecutar."
        }
      },
      required: ["command"],
      additionalProperties: false
    }
  },
  web_search: {
    type: "function" as const,
    name: "web_search",
    description:
        "Busca en la web información técnica cuando la documentación local (RAG) no es suficiente. Priorizar fuentes oficiales.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Consulta de búsqueda." },
        maxResults: { type: "number", description: "Cantidad máxima de resultados (default 5)." }
      },
      required: ["query", "maxResults"],
      additionalProperties: false
    }
  }
};

export function getToolDefinitions(toolNames: readonly ToolName[]): FunctionTool[] {
  const plugins = getDiscoveredPlugins();

  return toolNames.map((toolName): FunctionTool => {
    const builtIn = toolDefinitionsByName[toolName];
    if (builtIn) return builtIn;

    const plugin = plugins.get(toolName);
    if (plugin) {
      return {
        type: "function" as const,
        name: plugin.name,
        description: plugin.description,
        strict: true,
        parameters: plugin.parameters
      } as FunctionTool;
    }

    throw new Error(
        `No se encontró definición para la tool "${toolName}" (ni built-in ni plugin descubierto).`
    );
  });
}