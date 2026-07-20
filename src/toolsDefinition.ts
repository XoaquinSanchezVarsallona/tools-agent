import type { FunctionTool } from "openai/resources/responses/responses";
import type { ToolName } from "./tools/index";

const toolDefinitionsByName: Record<ToolName, FunctionTool> = {
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
  rag_search: {
    type: "function" as const,
    name: "rag_search",
    description: "Busca primero en la documentacion tecnica local indexada.",
    strict: true,
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false
    }
  },
  web_search: {
    type: "function" as const,
    name: "web_search",
    description: "Busca evidencia tecnica en la web cuando el RAG local no alcanza.",
    strict: true,
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false
    }
  },
  memory_read: {
    type: "function" as const,
    name: "memory_read",
    description: "Lee la memoria persistente del proyecto.",
    strict: true,
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    }
  },
  memory_write: {
    type: "function" as const,
    name: "memory_write",
    description: "Actualiza un resumen pequeno de la memoria del proyecto.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        importantFiles: { type: "array", items: { type: "string" } },
        conventions: { type: "array", items: { type: "string" } }
      },
      required: ["summary", "importantFiles", "conventions"],
      additionalProperties: false
    }
  }
};

export function getToolDefinitions(toolNames: readonly ToolName[]) {
  return toolNames.map((toolName) => toolDefinitionsByName[toolName]);
}
