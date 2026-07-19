import "./instrumentation";
import fs from "node:fs/promises";
import { setActiveTraceIO, startActiveObservation } from "@langfuse/tracing";
import { buildStorybook } from "./build";
import { writeGeneratedFiles } from "./files";
import { generateComponentFiles, GENERATION_MODEL } from "./generator";
import { shutdownLangfuse, startLangfuse } from "./instrumentation";
import { ingestRag } from "../rag/ingest";
import { RAG_INDEX_PATH } from "../rag/paths";
import { retrieveRelevantChunks } from "../rag/retrieve";

type RunSummary = {
  request: string;
  langfuseEnabled: boolean;
  generatedFiles: string[];
  retrievedDocuments: Array<{
    source: string;
    section: string;
    url: string;
    score: number;
  }>;
  build: {
    command: string;
    exitCode: number;
  };
};

async function main() {
  const request = process.argv.slice(2).join(" ").trim();

  if (!request) {
    throw new Error('Usage: npm run agent -- "Genera un boton para una aplicacion financiera"');
  }

  const langfuse = startLangfuse();

  try {
    const summary = await startActiveObservation(
      "minimal-react-component-agent",
      async (agent) => {
        agent.update({
          input: { request },
          metadata: {
            model: GENERATION_MODEL,
            langfuseEnabled: langfuse.enabled
          }
        } as any);
        setActiveTraceIO({ input: { request } });

        await ensureRagIndex(agent);

        const chunks = await agentStep(agent, "retrieve-rag-context", async (step) => {
          step.update({ input: { request, topK: 6 } } as any);
          const retrieved = await retrieveRelevantChunks(request, { topK: 6 });
          step.update({
            output: retrieved.map(toRetrievedDocument),
            metadata: { chunkCount: retrieved.length }
          } as any);
          return retrieved;
        });

        const generation = await agentStep(agent, "generate-button-files", async (step) => {
          step.update({
            input: {
              request,
              chunks: chunks.map(toRetrievedDocument)
            },
            metadata: { model: GENERATION_MODEL }
          } as any);
          const generated = await generateComponentFiles(request, chunks);
          step.update({
            output: {
              summary: generated.summary,
              files: generated.files.map((file) => file.path),
              sourcesUsed: generated.sourcesUsed
            }
          } as any);
          return generated;
        });

        const generatedFiles = await agentStep(agent, "write-generated-files", async (step) => {
          step.update({
            input: {
              componentName: generation.componentName,
              files: generation.files.map((file) => file.path)
            }
          } as any);
          const written = await writeGeneratedFiles(generation.files, generation.componentName);
          step.update({ output: { written } } as any);
          return written;
        });

        const build = await agentStep(agent, "build-storybook", async (step) => {
          step.update({ input: { command: "npm run build-storybook" } } as any);
          const result = await buildStorybook();
          step.update({
            output: {
              command: result.command,
              exitCode: result.exitCode,
              stdoutTail: tail(result.stdout),
              stderrTail: tail(result.stderr)
            }
          } as any);
          return result;
        });

        const summary: RunSummary = {
          request,
          langfuseEnabled: langfuse.enabled,
          generatedFiles,
          retrievedDocuments: chunks.map(toRetrievedDocument),
          build: {
            command: build.command,
            exitCode: build.exitCode
          }
        };

        agent.update({
          output: summary,
          metadata: {
            ok: build.exitCode === 0
          }
        } as any);
        setActiveTraceIO({ input: { request }, output: summary });

        if (build.exitCode !== 0) {
          throw new Error(`Storybook build failed with exit code ${build.exitCode}`);
        }

        return summary;
      },
      { asType: "agent" }
    );

    printSummary(summary);
  } finally {
    await shutdownLangfuse();
  }
}

async function ensureRagIndex(agent: any) {
  const step = agent.startObservation(
    "ensure-rag-index",
    { input: { path: RAG_INDEX_PATH } },
    { asType: "tool" }
  );

  try {
    await fs.access(RAG_INDEX_PATH);
    step.update({ output: { reused: true, path: RAG_INDEX_PATH } });
  } catch {
    const index = await ingestRag();
    step.update({
      output: {
        reused: false,
        path: RAG_INDEX_PATH,
        chunks: index.chunks.length,
        embeddingModel: index.embeddingModel
      }
    });
  } finally {
    step.end();
  }
}

async function agentStep<T>(
  agent: any,
  name: string,
  run: (step: any) => Promise<T>
): Promise<T> {
  const step = agent.startObservation(name, {}, { asType: "tool" });

  try {
    const result = await run(step);
    step.end();
    return result;
  } catch (error: unknown) {
    step.update({
      level: "ERROR",
      statusMessage: error instanceof Error ? error.message : String(error)
    });
    step.end();
    throw error;
  }
}

function toRetrievedDocument(chunk: {
  source: string;
  section: string;
  url: string;
  score: number;
}) {
  return {
    source: chunk.source,
    section: chunk.section,
    url: chunk.url,
    score: Number(chunk.score.toFixed(4))
  };
}

function printSummary(summary: RunSummary) {
  console.log("\nComponent agent finished.");
  console.log(`Langfuse tracing: ${summary.langfuseEnabled ? "enabled" : "disabled"}`);
  console.log(`Build: ${summary.build.command} -> exit ${summary.build.exitCode}`);

  console.log("\nGenerated files:");
  for (const file of summary.generatedFiles) {
    console.log(`- ${file}`);
  }

  console.log("\nRetrieved sources:");
  for (const document of summary.retrievedDocuments) {
    console.log(
      `- ${document.source} | ${document.section} | score ${document.score} | ${document.url}`
    );
  }
}

function tail(value: string, maxLength = 2000) {
  if (value.length <= maxLength) return value;
  return value.slice(value.length - maxLength);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
