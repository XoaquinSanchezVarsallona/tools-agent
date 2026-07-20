import fs from "node:fs/promises";

export async function listFilesTool(args: { path: string }) {
    const files = await fs.readdir(args.path, { withFileTypes: true });
    return {
        path: args.path,
        files: files.map((file) => ({
            name: file.name,
            type: file.isDirectory() ? "directory" : "file"
        }))
    };
}
