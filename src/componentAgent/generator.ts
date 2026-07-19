import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import type { RetrievedChunk } from "../rag/types";

export const GENERATION_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.2";

let openai: OpenAI | undefined;

export type GeneratedFile = {
  path: string;
  content: string;
};

export type ComponentGeneration = {
  componentName: string;
  files: GeneratedFile[];
  summary: string;
  sourcesUsed: Array<{
    source: string;
    section: string;
    url: string;
  }>;
};

const COMPONENT_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

export async function generateComponentFiles(
  userRequest: string,
  chunks: RetrievedChunk[]
): Promise<ComponentGeneration> {
  const response = await getOpenAI().responses.create({
    model: GENERATION_MODEL,
    instructions: buildInstructions(),
    input: buildPrompt(userRequest, chunks)
  });

  return parseGeneration(response.output_text);
}

function getOpenAI() {
  openai ??= observeOpenAI(
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }),
    {
      traceName: "react-component-agent",
      generationName: "generate-react-component",
      tags: ["component-agent", "storybook", "rag"]
    }
  );

  return openai;
}

function buildInstructions() {
  return `
You generate React TypeScript components and Storybook stories based on the user's request.
Return only valid JSON, with no markdown fences.
The JSON object must match:
{
  "componentName": "PascalCaseName",
  "summary": "short summary",
  "sourcesUsed": [{"source":"...", "section":"...", "url":"..."}],
  "files": [{"path":"src/components/generated/PascalCaseName/PascalCaseName.tsx", "content":"..."}]
}
Infer a short PascalCase componentName from the user request (e.g. "GameCard", "PricingTable", "Button").
Generate exactly these three files, using componentName consistently in every path and filename:
- src/components/generated/{componentName}/{componentName}.tsx
- src/components/generated/{componentName}/{componentName}.css
- src/components/generated/{componentName}/{componentName}.stories.tsx
Do not include any other file path.
Use React TypeScript, CSS, and Storybook CSF.
The story file must include a Default export plus at least two additional variants relevant to the component and the requested visual style.
The component must be accessible, reusable, and must not depend on packages outside React.
`.trim();
}

function buildPrompt(userRequest: string, chunks: RetrievedChunk[]) {
  const context = chunks
    .map(
      (chunk, index) => `
[${index + 1}] ${chunk.source} - ${chunk.section}
URL: ${chunk.url}
Similarity: ${chunk.score.toFixed(4)}
${chunk.content}
`.trim()
    )
    .join("\n\n");

  return `
User request:
${userRequest}

Retrieved design documentation:
${context}

Implement a polished React component that satisfies the user request. Use the retrieved Apple and Material guidance as design context, adapting it to the visual style the user asked for.
`.trim();
}

function parseGeneration(raw: string): ComponentGeneration {
  const json = extractJson(raw);
  const parsed = JSON.parse(json) as ComponentGeneration;

  if (!Array.isArray(parsed.files)) {
    throw new Error("Model output is missing files[]");
  }

  if (!parsed.componentName || !COMPONENT_NAME_PATTERN.test(parsed.componentName)) {
    throw new Error("Model output is missing a valid PascalCase componentName");
  }

  return parsed;
}

function extractJson(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();

  throw new Error("Model did not return a JSON object");
}
