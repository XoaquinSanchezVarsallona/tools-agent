export const readFileToolDefinition = {
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
} as const;
