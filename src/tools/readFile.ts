import fs from "node:fs/promises";

export async function readFileTool(args: { path: string }) {
    const content = await fs.readFile(args.path, "utf-8");
    return { path: args.path, content };
}
