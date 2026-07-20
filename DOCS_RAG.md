# Retrieval-Augmented Generation (RAG)

## Table of contents

- [Overview](#overview)
- [Corpus and sources](#corpus-and-sources)
- [Chunking strategy](#chunking-strategy)
- [Embeddings](#embeddings)
- [Storage and VectorStore](#storage-and-vectorstore)
- [Retrieval](#retrieval)
- [Ingestion pipeline](#ingestion-pipeline)
- [Maintenance](#maintenance)
- [Examples and use cases](#examples-and-use-cases)
- [References](#references)
- [Appendix](#appendix)

## Overview

The RAG subsystem gives `tools-agent` access to project-specific reference material without placing the entire corpus in every prompt. It ingests local documents or web pages, splits them into searchable chunks, creates OpenAI embeddings, and stores those vectors locally. During an orchestrated request, the researcher subagent embeds the user's query, retrieves semantically similar chunks, and supplies the retrieved text and source metadata to the LLM. If no chunk clears the relevance threshold, the researcher can fall back to web search.

## Corpus and sources

### Current local corpus

The repository includes these documents under [`src/rag/corpus`](./src/rag/corpus/):

| File | Subject |
| --- | --- |
| [`zod.md`](./src/rag/corpus/zod.md) | Schema validation with Zod. |
| [`express-routing.md`](./src/rag/corpus/express-routing.md) | Express routing patterns. |
| [`node-test.md`](./src/rag/corpus/node-test.md) | Testing with Node.js's built-in test runner. |

### Supported source formats

Local sources should be UTF-8 Markdown or plain-text files. Markdown is preferred because headings provide meaningful chunk boundaries and labels. URL sources are downloaded as HTML and converted to plain body text before chunking.

Define the ingestion set in a repository-root `rag.sources.json` file:

```json
[
  { "type": "file", "value": "src/rag/corpus/zod.md" },
  { "type": "file", "value": "src/rag/corpus/express-routing.md" },
  { "type": "file", "value": "src/rag/corpus/node-test.md" },
  { "type": "url", "value": "https://example.com/engineering-guide" }
]
```

Paths are resolved relative to the current working directory. Run ingestion from the repository root so both `rag.sources.json` and relative file paths resolve correctly.

### Source-quality guidelines

- Prefer accurate, maintained, primary documentation over summaries of uncertain origin.
- Use descriptive `#`, `##`, and `###` headings; headings become retrieval metadata.
- Keep each section focused on one concept so a retrieved chunk is useful on its own.
- Prefer small- to medium-sized documents. Split very large manuals by topic before ingestion.
- Remove navigation, duplicated boilerplate, generated indexes, and unrelated content.
- Include enough context in each section to make terminology and examples unambiguous.
- Re-ingest sources whenever their authoritative content changes.

## Chunking strategy

Chunking is implemented by [`src/rag/chunk.ts`](./src/rag/chunk.ts). The algorithm has two stages:

1. Split the document at Markdown headings matching `#`, `##`, or `###` followed by whitespace. Content before the first heading is labeled `(sin título)`.
2. Split every section into fixed character windows no longer than `MAX_CHUNK_CHARS`, carrying `OVERLAP_CHARS` characters from the preceding window into the next one.

Current parameters:

```ts
const MAX_CHUNK_CHARS = 800;
const OVERLAP_CHARS = 120;
```

Chunks are character-based, not token- or sentence-based. Each non-empty chunk stores:

| Field | Meaning |
| --- | --- |
| `source` | Original file path or URL exactly as declared in `rag.sources.json`. |
| `heading` | Most recent level 1–3 Markdown heading, without the `#` prefix. |
| `content` | Trimmed text for this window. The heading line itself is included in the section content. |
| `chunkIndex` | Zero-based index assigned across the complete source document. |

### Overlap example

Assume a section contains 1,100 characters. The real limits are shown below using ranges rather than 1,100 literal characters:

```text
Section: "## Request validation"

Chunk 0: characters   0–799   (800 characters)
Chunk 1: characters 680–1099  (420 characters)
                    ^^^
                    characters 680–799 repeat the final 120 characters of chunk 0
```

The overlap preserves context when an explanation or code example crosses a boundary. `chunkIndex` would be `0` and `1` if these were the first chunks in the document, and both chunks would use the heading `Request validation`.

### Tuning

- Increase the maximum size when useful answers require long surrounding context, but account for larger prompts and less precise matches.
- Decrease it for dense reference material where individual concepts are short and independent.
- Increase overlap when sentences, code blocks, or examples frequently cross chunk boundaries. Excessive overlap increases storage, embedding cost, and duplicate retrieval.
- Languages with long compound words, multibyte scripts, or different sentence-boundary conventions may benefit from token-aware or sentence-aware splitting instead of raw character windows.
- Long-form documentation often benefits from semantic paragraph boundaries and heading hierarchy before changing numeric limits.
- After tuning, rebuild the entire index because stored chunks encode the previous strategy.

## Embeddings

The configured default is OpenAI's `text-embedding-3-small`, controlled by `embeddingModel` in [`agent.config.json`](./agent.config.json). Its default output is 1,536 dimensions. This project does not currently request a custom dimension count, so the API's default dimensionality is used.

[`embedTexts`](./src/rag/embeddings.ts) sends all chunks for one source to the embeddings API in a single request:

```ts
const response = await llm.embeddings.create({
  model,
  input: texts
});
```

Batching reduces HTTP round trips and request overhead while preserving one returned vector per input string. For very large sources, production deployments should split inputs into bounded batches to respect provider token and input-count limits and to support retries without repeating the entire source.

### Embedding telemetry

Embedding calls are wrapped in an `llm.embedding` observation when a telemetry adapter is supplied. The observation captures:

- Model and input text count.
- Prompt and total token usage returned by the API.
- Number and dimensionality of returned vectors.
- Estimated cost when `LANGFUSE_EMBEDDING_COST_PER_MILLION_USD` is configured.

The standalone ingestion script currently calls `embedTexts` without an enabled telemetry instance, so it uses the no-op adapter. Query embeddings inherit the active agent telemetry through `retrieveFromRag`.

### Alternatives and tradeoffs

| Option | Advantages | Tradeoffs |
| --- | --- | --- |
| Larger hosted embedding model | Often improves semantic discrimination and difficult retrieval. | Higher cost, larger vectors, more storage, and potentially slower search. Requires a full reindex. |
| Smaller or cheaper hosted model | Lower ingestion/query cost and smaller operational footprint. | May reduce recall or ranking quality for nuanced queries. |
| On-premises/open-weight model | Data remains under local control; predictable infrastructure costs; offline operation is possible. | Requires model serving, monitoring, capacity planning, and careful compatibility testing. |
| Domain-specific fine-tuned model | Can improve relevance for specialized terminology. | Requires representative training/evaluation data and adds lifecycle complexity. |

Never mix embeddings produced by different models or dimensions in the same searchable index. Change the model and rebuild all records together.

## Storage and VectorStore

The current vector store is a JSON array at `.agent-data/rag/vectors.json`, as selected by `paths.rag` in [`agent.config.json`](./agent.config.json). [`VectorStore`](./src/rag/store.ts) creates the parent directory on construction and loads the complete file into memory.

Each persisted record has this shape:

```ts
{
  source: string;
  heading: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
}
```

Example:

```json
{
  "source": "src/rag/corpus/zod.md",
  "heading": "Validating request bodies",
  "chunkIndex": 3,
  "content": "Use safeParse when validation failures are expected...",
  "embedding": [0.0123, -0.0045, 0.031]
}
```

The abbreviated embedding above is illustrative; a default `text-embedding-3-small` vector contains 1,536 numbers.

### Operations and persistence

- `insertChunk(chunk, embedding)` appends one record and rewrites the JSON file immediately.
- `insertChunks(chunks, embeddings)` appends a batch and rewrites the file once, which is more efficient for ingestion.
- `clearSource(source)` removes every record whose `source` exactly matches the provided value, then persists immediately.
- `countChunks()` returns the in-memory record count.
- `close()` is a no-op because the JSON store holds no database connection.

Writes serialize the full in-memory array with indentation. Persistence is synchronous and is not transactional: interruption during a write could leave an incomplete file, and concurrent writers can overwrite each other's state.

### Scalability and migration

The JSON store is suitable for development and small corpora. Search is an in-memory linear scan over every vector, or approximately `O(number of records × embedding dimensions)`. Startup, memory consumption, search latency, and full-file rewrites become limiting as the corpus grows.

Suggested migration targets:

| Store | Strengths | Tradeoffs |
| --- | --- | --- |
| PostgreSQL + pgvector | Familiar SQL, transactions, filters, backups, and easy integration with existing PostgreSQL deployments. | Requires database operations and index tuning; dedicated vector systems may scale further. |
| Milvus | Open-source, built for large vector collections and approximate-nearest-neighbor indexes. | More infrastructure and operational complexity than a local file or PostgreSQL. |
| Pinecone | Managed scaling, metadata filtering, and minimal infrastructure management. | Vendor dependency, ongoing service cost, and remote data-governance considerations. |

A migration should preserve the `VectorStore` behavior behind an interface, store embedding-model/version metadata, add batch upserts and deletes by source, and use an approximate-nearest-neighbor index when corpus size warrants it.

## Retrieval

[`retrieveFromRag`](./src/rag/retrieve.ts) performs the following flow:

1. Resolve `config.paths.rag` and load the vector store.
2. Embed the user's query with `config.embeddingModel`.
3. Calculate cosine similarity between the query vector and every stored vector.
4. Discard records below `minScore`.
5. Sort remaining records by descending similarity.
6. Return at most `topK` chunks.
7. Convert results into source references and expose whether any evidence was found.

Defaults:

```ts
const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.55;
```

Cosine similarity measures vector direction rather than magnitude. Higher scores are treated as more semantically relevant. Each returned `RetrievedChunk` contains the stored metadata plus `score`. The researcher formats the selected chunk contents into its synthesis prompt; it also records source references such as `source#heading (chunk N)` in task state.

### Retrieval and prompt assembly pseudo-code

```ts
const queryVector = await embedText(query, config.embeddingModel);
const store = new VectorStore(config.paths.rag);

const matches = store.search(
  queryVector,
  5,    // top-K
  0.55  // minimum cosine score
);

const context = matches
  .map((chunk) => [
    `Source: ${chunk.source}`,
    `Heading: ${chunk.heading}`,
    `Score: ${chunk.score.toFixed(3)}`,
    chunk.content
  ].join("\n"))
  .join("\n\n---\n\n");

const answer = await runAgentTurn(
  `Answer the query using the retrieved context.\n\nQuery: ${query}\n\n${context}`,
  conversation,
  options
);
```

Tune `topK` and `minScore` together using representative queries. A threshold that is too high causes useful evidence to be missed; one that is too low injects irrelevant context and can degrade the final response.

## Ingestion pipeline

The ingestion entrypoint is [`src/rag/ingest.ts`](./src/rag/ingest.ts). It performs these steps:

### Prerequisites and cost

Before running ingestion:

- Install the project dependencies with `npm install`.
- Set a valid `OPENAI_API_KEY` in `.env`; ingestion sends every generated chunk to the OpenAI embeddings API.
- Ensure the machine has internet access to OpenAI. URL sources additionally require network access to each source host.
- Review the configured `embeddingModel` and source set before starting. Embedding API usage is billable, and re-ingesting sources generates new embeddings and may incur additional charges.
- Create `rag.sources.json` in the repository root and run the command from that directory.

1. Load environment variables and `agent.config.json`.
2. Resolve the vector-store path from `config.paths.rag`.
3. Load source declarations from root-level `rag.sources.json`.
4. For each `file` source, read UTF-8 text from disk.
5. For each `url` source, download it with `fetch`, parse it with Cheerio, remove `script`, `style`, `nav`, `footer`, and `header` elements, then normalize excessive blank lines in the body text.
6. Run `chunkMarkdown(source.value, rawContent)`.
7. Call `clearSource(source.value)` so the source is replaced rather than duplicated.
8. Batch the chunk contents through `embedTexts` using `config.embeddingModel`.
9. Call `insertChunks` to append the new records and persist the JSON file.
10. Print the final total and close the store.

Run ingestion from the repository root:

```bash
npx tsx src/rag/ingest.ts
```

Typical output:

```text
Encontradas 4 fuente(s) en rag.sources.json
  src/rag/corpus/zod.md: 7 chunk(s)
  src/rag/corpus/express-routing.md: 5 chunk(s)
  src/rag/corpus/node-test.md: 6 chunk(s)
  Descargando https://example.com/engineering-guide...
  https://example.com/engineering-guide: 9 chunk(s)
Ingesta completa. Total de chunks en el store: 27
```

Exact chunk counts depend on source content and may differ from this example.

## Maintenance

### Reindexing

To reindex configured sources after changing content, the embedding model, or chunking parameters:

```bash
npx tsx src/rag/ingest.ts
```

For every listed source, ingestion calls `clearSource` before inserting new chunks. This clears and re-ingests that source automatically. Sources removed from `rag.sources.json` are **not** automatically removed from the vector store; either clear them through `VectorStore.clearSource(exactSourceValue)` or rebuild the file from scratch.

To perform a complete rebuild safely, first back up the current file, move it out of the configured location, and then run ingestion. Avoid deleting the only copy until the rebuilt index has been verified.

### Monitoring

- Review ingestion logs for source count, per-source chunk count, download failures, and final record count.
- Monitor `llm.embedding` telemetry for token usage, vector dimensions, latency, and estimated cost when telemetry is enabled in the calling workflow.
- Track retrieval result counts and scores. Frequent empty results can indicate stale sources, a threshold that is too high, or vocabulary mismatch.
- Watch `vectors.json` size, process memory, and query latency as the corpus grows.
- Validate that all records use the configured embedding model and expected dimensions after configuration changes.

### Backup and versioning

- Back up `.agent-data/rag/vectors.json` before reindexing or changing models.
- Prefer versioning `rag.sources.json`, corpus files, the embedding model name, and chunking parameters rather than committing a large generated vector file.
- If vectors must be retained as build artifacts, record a checksum and metadata describing the source revision, model, dimensions, and generation time.
- Use timestamped or content-addressed backups and test restoration periodically.
- Do not allow simultaneous ingestion processes to write the same JSON store.

## Examples and use cases

### Example query: request validation

```text
How should this Express endpoint validate a user creation body with Zod?
```

RAG can retrieve the Zod validation guidance and Express routing material together. The researcher can ground its response in the project's preferred validation API and route structure instead of relying only on general model knowledge.

### Example query: test coverage

```text
Write node:test cases for an Express route that rejects malformed input.
```

RAG can combine relevant chunks from `node-test.md`, `express-routing.md`, and `zod.md`, helping the agent propose test structure, route behavior, and expected validation failures consistently with the local corpus.

### Add and ingest a new document

1. Create a focused Markdown document, for example `src/rag/corpus/error-handling.md`:

   ```markdown
   # API error handling

   ## Validation errors

   Return HTTP 400 with a stable error payload when request validation fails.
   ```

2. Add it to `rag.sources.json`:

   ```json
   [
     { "type": "file", "value": "src/rag/corpus/zod.md" },
     { "type": "file", "value": "src/rag/corpus/express-routing.md" },
     { "type": "file", "value": "src/rag/corpus/node-test.md" },
     { "type": "file", "value": "src/rag/corpus/error-handling.md" }
   ]
   ```

3. Re-run ingestion:

   ```bash
   npx tsx src/rag/ingest.ts
   ```

4. Confirm that the final chunk count increased and test a query that should retrieve the new source.

## References

| Path | Responsibility |
| --- | --- |
| [`src/rag/chunk.ts`](./src/rag/chunk.ts) | Heading-based and size-based chunking. |
| [`src/rag/embeddings.ts`](./src/rag/embeddings.ts) | Batch and single-text embedding calls plus telemetry. |
| [`src/rag/store.ts`](./src/rag/store.ts) | JSON persistence, source replacement, counting, and cosine search. |
| [`src/rag/ingest.ts`](./src/rag/ingest.ts) | File/URL loading, HTML sanitization, chunking, embedding, and insertion. |
| [`src/rag/retrieve.ts`](./src/rag/retrieve.ts) | Query embedding, top-K filtering, result/source construction, and retrieval telemetry. |
| [`src/rag/corpus/`](./src/rag/corpus/) | Bundled local reference documents. |
| [`src/subagents/researcher.ts`](./src/subagents/researcher.ts) | RAG-first researcher workflow and LLM context synthesis. |
| [`src/observability/telemetry.ts`](./src/observability/telemetry.ts) | Telemetry adapters, token/cost fields, redaction, and flushing. |
| [`agent.config.json`](./agent.config.json) | Controls `embeddingModel` and the vector path at `paths.rag`. |

## Appendix

### Glossary

| Term | Definition |
| --- | --- |
| Chunk | A bounded piece of source text with source, heading, and positional metadata. |
| Embedding | A numeric vector representing the semantic meaning of text. |
| Vector store | A persistence and search layer for content and its embeddings. |
| Cosine similarity | A measure of the angle between two vectors; higher values indicate closer semantic direction. |
| Top-K | The maximum number (`K`) of highest-ranked matches returned by a search. |

### Quick commands

Re-ingest every source listed in `rag.sources.json`:

```bash
npx tsx src/rag/ingest.ts
```

List the number of stored vector records without modifying the store:

```bash
node -e 'const fs=require("node:fs"); const p=".agent-data/rag/vectors.json"; const rows=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):[]; console.log(rows.length)'
```

Inspect configured source declarations:

```bash
node -e 'console.log(JSON.stringify(require("./rag.sources.json"), null, 2))'
```

Inspect the configured RAG path:

```bash
node -e 'console.log(require("./agent.config.json").paths.rag)'
```
