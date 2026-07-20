import fs from "node:fs/promises";
import path from "node:path";

export async function writeFileTool(args: { path: string; content: string }) {
  await fs.mkdir(path.dirname(path.resolve(args.path)), { recursive: true });
  await fs.writeFile(args.path, args.content, "utf-8");

  return {
    success: true,
    path: args.path,
    message: "Archivo escrito correctamente."
  };
}
