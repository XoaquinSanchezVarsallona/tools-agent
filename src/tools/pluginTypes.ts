export interface ToolParameterSchema {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
    [key: string]: unknown;
}

export interface ToolPermissionPolicy {
    requiresApproval?: boolean;
    modifiesFilesystem?: boolean;
}

export interface ToolPlugin<Args = any, Result = any> {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
    execute: (args: Args) => Promise<Result>;
    policy?: ToolPermissionPolicy;
}

export function definePlugin<Args = any, Result = any>(
    plugin: ToolPlugin<Args, Result>
): ToolPlugin<Args, Result> {
    return plugin;
}