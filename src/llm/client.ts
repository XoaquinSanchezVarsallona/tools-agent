import OpenAI from "openai";
import "dotenv/config";

export const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});