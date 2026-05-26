export const runCommandToolDefinition = {
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
} as const;
