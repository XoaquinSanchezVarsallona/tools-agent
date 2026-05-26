export const listFilesToolDefinition = {
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
} as const;
