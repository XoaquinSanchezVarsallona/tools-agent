import { getLlm, MODEL } from "../llm/client";

export async function webSearchTool(args: { query: string }) {
  const response = await getLlm().responses.create({
    model: MODEL,
    input: `Search the web for technical evidence about: ${args.query}. Prefer official documentation. Summarize the useful findings and cite sources.`,
    tools: [{ type: "web_search" }],
    include: ["web_search_call.action.sources"]
  });

  return {
    query: args.query,
    summary: response.output_text,
    sources: collectSources(response.output)
  };
}

function collectSources(value: unknown) {
  const sources = new Map<string, { title: string; url: string }>();

  function visit(item: unknown) {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (!item || typeof item !== "object") return;

    const record = item as Record<string, unknown>;
    if (typeof record.url === "string" && record.url.startsWith("http")) {
      sources.set(record.url, {
        title: typeof record.title === "string" ? record.title : record.url,
        url: record.url
      });
    }
    Object.values(record).forEach(visit);
  }

  visit(value);
  return [...sources.values()];
}
