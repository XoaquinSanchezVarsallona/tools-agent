export const toolDefinitions = [
  {
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
  {
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
  {
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
  {
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
  }
];