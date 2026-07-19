import fs from "node:fs/promises";
import path from "node:path";
import type { GeneratedFile } from "./generator";

const GENERATED_BUTTON_DIR = path.resolve("src/components/generated/Button");
const EXPECTED_FILES = [
  "src/components/generated/Button/Button.tsx",
  "src/components/generated/Button/Button.css",
  "src/components/generated/Button/Button.stories.tsx"
];

export async function writeGeneratedFiles(files: GeneratedFile[]) {
  validateGeneratedFiles(files);
  await fs.mkdir(GENERATED_BUTTON_DIR, { recursive: true });

  for (const file of files) {
    await fs.writeFile(path.resolve(file.path), file.content, "utf-8");
  }

  return files.map((file) => file.path);
}

function validateGeneratedFiles(files: GeneratedFile[]) {
  const paths = files.map((file) => normalizePath(file.path)).sort();
  const expected = [...EXPECTED_FILES].sort();

  if (paths.length !== expected.length) {
    throw new Error(`Expected ${expected.length} generated files, got ${paths.length}`);
  }

  for (let index = 0; index < expected.length; index++) {
    if (paths[index] !== expected[index]) {
      throw new Error(`Unexpected generated file path: ${paths[index]}`);
    }
  }

  for (const file of files) {
    const resolvedPath = path.resolve(file.path);
    if (!resolvedPath.startsWith(`${GENERATED_BUTTON_DIR}${path.sep}`)) {
      throw new Error(`Generated path is outside Button directory: ${file.path}`);
    }
    if (typeof file.content !== "string" || file.content.trim() === "") {
      throw new Error(`Generated file has empty content: ${file.path}`);
    }
  }
}

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}
