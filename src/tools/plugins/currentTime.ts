import { definePlugin } from "../pluginTypes";

export default definePlugin({
    name: "get_current_time",
    description:
        "Devuelve la fecha y hora actual en formato ISO 8601. Útil para saber qué día es o generar timestamps.",
    parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false
    },
    execute: async () => {
        return { now: new Date().toISOString() };
    },
    policy: {
        requiresApproval: false,
        modifiesFilesystem: false
    }
});