import fs from "node:fs/promises";
import path from "node:path";
import type { GeneratedFile } from "./generator";

const GENERATED_ROOT = path.resolve("src/components/generated");
const COMPONENT_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

export async function writeGeneratedFiles(files: GeneratedFile[], componentName: string) {
  validateGeneratedFiles(files, componentName);

  const componentDir = path.join(GENERATED_ROOT, componentName);
  await fs.mkdir(componentDir, { recursive: true });

  for (const file of files) {
    await fs.writeFile(path.resolve(file.path), file.content, "utf-8");
  }

  return files.map((file) => file.path);
}

function validateGeneratedFiles(files: GeneratedFile[], componentName: string) {
  if (!COMPONENT_NAME_PATTERN.test(componentName)) {
    throw new Error(`Invalid component name: ${componentName}`);
  }

  const componentDir = path.join(GENERATED_ROOT, componentName);
  const expected = [
    `src/components/generated/${componentName}/${componentName}.tsx`,
    `src/components/generated/${componentName}/${componentName}.css`,
    `src/components/generated/${componentName}/${componentName}.stories.tsx`
  ].sort();

  const paths = files.map((file) => normalizePath(file.path)).sort();

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
    if (!resolvedPath.startsWith(`${componentDir}${path.sep}`)) {
      throw new Error(`Generated path is outside component directory: ${file.path}`);
    }
    if (typeof file.content !== "string" || file.content.trim() === "") {
      throw new Error(`Generated file has empty content: ${file.path}`);
    }
  }
}

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}
