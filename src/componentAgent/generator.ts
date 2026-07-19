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
  files: GeneratedFile[];
  summary: string;
  sourcesUsed: Array<{
    source: string;
    section: string;
    url: string;
  }>;
};

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
You generate React TypeScript components and Storybook stories.
Return only valid JSON, with no markdown fences.
The JSON object must match:
{
  "summary": "short summary",
  "sourcesUsed": [{"source":"...", "section":"...", "url":"..."}],
  "files": [{"path":"src/components/generated/Button/Button.tsx", "content":"..."}]
}
Generate exactly these three files:
- src/components/generated/Button/Button.tsx
- src/components/generated/Button/Button.css
- src/components/generated/Button/Button.stories.tsx
Do not include any other file path.
Use React TypeScript, CSS, and Storybook CSF.
The Button story must include Primary, Secondary, Disabled, and Loading.
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

Implement a polished Button for the user request. Use the retrieved Apple and Material guidance as design context. Keep the component practical for a financial application.
`.trim();
}

function parseGeneration(raw: string): ComponentGeneration {
  const json = extractJson(raw);
  const parsed = JSON.parse(json) as ComponentGeneration;

  if (!Array.isArray(parsed.files)) {
    throw new Error("Model output is missing files[]");
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
