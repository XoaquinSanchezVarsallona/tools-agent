import OpenAI from "openai";
import "dotenv/config";
import { observeOpenAI } from "@langfuse/openai";

let client: OpenAI | undefined;

export const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.2";

export function getLlm() {
  client ??= observeOpenAI(
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    { traceName: "coding-agent", tags: ["tp-final", "multi-agent"] }
  );
  return client;
}
