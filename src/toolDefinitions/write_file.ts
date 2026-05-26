export const writeFileToolDefinition = {
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
} as const;
