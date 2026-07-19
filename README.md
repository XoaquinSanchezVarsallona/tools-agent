# tools-agent

`tools-agent` is an interactive TypeScript/Node.js coding agent powered by the OpenAI API. It can inspect and modify a local workspace, run terminal commands, plan changes without applying them, retrieve project knowledge through a local RAG index, and coordinate specialized explorer, researcher, implementer, tester, and reviewer subagents. Configurable policies, supervised actions, loop detection, verification commands, project memory, and optional Langfuse telemetry provide guardrails and visibility for development use.

## Prerequisites

- Node.js 20 or newer
- npm
- An OpenAI API key

Check your local versions with:

```bash
node --version
npm --version
```

## Installation

1. Clone the repository and enter it:

   ```bash
   git clone https://github.com/XoaquinSanchezVarsallona/tools-agent.git
   cd tools-agent
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a local environment file from the example:

   ```bash
   cp .env.example .env
   ```

4. Set your OpenAI API key in `.env`:

   ```dotenv
   OPENAI_API_KEY=your-openai-api-key
   ```

5. Confirm that the project builds and its tests pass:

   ```bash
   npm run build
   npm test
   ```

The `.env` file is intentionally blocked from agent reads and writes by the default policy. Never commit it.

## Configuration

Runtime behavior is configured in [`agent.config.json`](./agent.config.json). The most important fields are:

| Field | Purpose |
| --- | --- |
| `model` | OpenAI model used for agent reasoning and responses. |
| `embeddingModel` | OpenAI embedding model used to index and query RAG content. |
| `paths.rag` | Location of the local vector store; defaults to `.agent-data/rag/vectors.json`. |
| `policies` | Read, write, and command restrictions, plus commands that always require approval. |
| `verificationCommands` | Commands the workflow recognizes as project verification, currently `npm test` and `npm run build`. |
| `maxIterations` | Maximum number of model/tool loop iterations in one agent turn. |
| `conversationWindow` | Conversation size at which older context is summarized. |
| `langfuse.enabled` | Enables or disables Langfuse telemetry initialization. |

Environment variables:

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | API key used for OpenAI responses and embeddings. |
| `AGENT_CONFIG_PATH` | No | Alternate configuration path; defaults to `./agent.config.json`. |
| `AGENT_WORKSPACE` | No | Workspace the agent operates on; defaults to `./fixture-user-api`. |
| `LANGFUSE_PUBLIC_KEY` | For telemetry | Langfuse public key. |
| `LANGFUSE_SECRET_KEY` | For telemetry | Langfuse secret key. |
| `LANGFUSE_BASE_URL` | No | Langfuse endpoint; defaults to `https://cloud.langfuse.com`. |
| `LANGFUSE_TRACING_ENVIRONMENT` | No | Environment label such as `development`. |
| `LANGFUSE_INPUT_COST_PER_MILLION_USD` | No | Explicit input-token cost estimate. |
| `LANGFUSE_OUTPUT_COST_PER_MILLION_USD` | No | Explicit output-token cost estimate. |
| `LANGFUSE_EMBEDDING_COST_PER_MILLION_USD` | No | Explicit embedding-token cost estimate. |

## Usage

Start the interactive CLI with either command:

```bash
npx tsx src/index.ts
```

```bash
npm start
```

Example session:

```text
Usuario: /orchestrator on
Modo Orchestrator activado.

Usuario: inspect the API, add request validation, and verify the change
[routing] Seleccionando subagentes.
...

Usuario: /orchestrator off
Modo Orchestrator desactivado; modo normal activo.

Usuario: /plan on
Plan mode activado.

Usuario: plan a refactor of the persistence layer
Agente: 1. Inspect the current persistence boundary...

Usuario: /plan off
Plan mode desactivado.

Usuario: /supervision off
Supervisión desactivada.

Usuario: implement the approved refactor
...

Usuario: /exit
```

Plan mode is only available in normal mode, so disable the orchestrator before entering it.

## Scripts

| Script | Description |
| --- | --- |
| `npm start` | Runs the TypeScript CLI with `tsx`. |
| `npm run build` | Compiles the project with `tsc`. |
| `npm test` | Builds the project and runs the Node.js orchestrator/telemetry tests through `tsx`. |

## CLI commands and modes

| Command | Effect | Example |
| --- | --- | --- |
| `/orchestrator on` | Enables adaptive coordination of specialized subagents. Implementation tasks are tested and reviewed, with at most one repair cycle. | `/orchestrator on` |
| `/orchestrator off` | Returns to the single-agent normal mode. | `/orchestrator off` |
| `/plan on` | Enables read-only planning in normal mode. The agent can inspect files and propose work but cannot modify the workspace. | `/plan on` |
| `/plan off` | Leaves planning and restores normal tool access. | `/plan off` |
| `/supervision on` | Requests confirmation before actions that modify the system. This is the initial setting. | `/supervision on` |
| `/supervision off` | Allows policy-permitted modifying actions without an interactive confirmation. | `/supervision off` |
| `/exit` | Flushes telemetry and closes the CLI. | `/exit` |

Normal mode is active at startup. Submit a natural-language request directly to use it:

```text
Usuario: inspect src/agent/harness.ts and explain how tool calls are validated
```

## RAG

The local retrieval pipeline chunks configured files or URLs, generates embeddings, and stores vectors at `.agent-data/rag/vectors.json`. See the [RAG implementation](./src/rag/) and [bundled corpus](./src/rag/corpus/) for the ingestion, retrieval, storage, and example-source documentation.

To add or rebuild sources, create `rag.sources.json` in the repository root:

```json
[
  { "type": "file", "value": "src/rag/corpus/zod.md" },
  { "type": "url", "value": "https://example.com/documentation" }
]
```

Then run:

```bash
npx tsx src/rag/ingest.ts
```

Re-ingesting a source replaces its existing chunks while preserving other indexed sources.

## Security and policies

The checked-in configuration denies these paths and commands:

```json
{
  "deniedRead": [".env", "secrets/", ".pem"],
  "deniedWrite": [".git/", ".github/", "package-lock.json", ".env"],
  "deniedCommands": ["rm -rf", "git push", "git reset --hard", "format c:"]
}
```

Denied operations cannot be executed even when supervision is off. With supervision enabled, modifying tools such as file writes and command execution prompt for `y` or `n` before running. Commands listed under `policies.approvalCommands`—currently `npm install`, `npm i`, `git commit`, and `pip install`—require approval according to policy. Keep supervision enabled when operating on valuable or unfamiliar workspaces.

## Telemetry

The agent supports Langfuse telemetry for prompts, model generations, token usage, estimated costs, iterations, tool calls, retrieved documents, web searches, errors, subagents, and repair cycles. Enable or disable it with `langfuse.enabled` in [`agent.config.json`](./agent.config.json), and provide the Langfuse credentials in `.env`. If telemetry is disabled or credentials are absent, a no-op adapter lets the agent continue normally; tests use an in-memory adapter and do not send traces externally.

## Troubleshooting

1. **`OPENAI_API_KEY` is missing or authentication fails**

   Copy `.env.example` to `.env`, set a valid `OPENAI_API_KEY`, and restart the CLI. Ensure the value has no extra quotes or whitespace.

2. **The Node.js version is incompatible**

   Run `node --version`. Upgrade to Node.js 20 or newer, then remove and reinstall dependencies if they were installed with an older runtime.

3. **The agent cannot write `.agent-data`**

   Verify that the current user can write to the repository and `.agent-data` directories. Create the directory with `mkdir -p .agent-data/rag` if necessary, and correct its ownership or permissions without making it globally writable.

4. **RAG ingestion or web search cannot fetch a URL**

   Confirm network and DNS access, verify that the URL is public, and check whether the remote site blocks automated requests. Prefer a local file source when a site requires authentication or JavaScript rendering.

5. **Tests fail**

   Run `npm run build` first to expose TypeScript errors, then run `npm test`. Reinstall dependencies with `npm install` if modules or native bindings such as `better-sqlite3` are missing, and review the first failing assertion or compiler diagnostic.

## Project layout

```text
tools-agent/
├── agent.config.json       # Models, paths, policies, verification, and telemetry
├── src/
│   ├── index.ts            # Interactive CLI entrypoint
│   ├── agent/              # Agent harness, context, loop detection, orchestration
│   ├── llm/                # OpenAI client
│   ├── memory/             # Persistent project-memory synthesis
│   ├── observability/      # Langfuse, no-op, and in-memory telemetry adapters
│   ├── policies/           # Configuration loading and tool-call validation
│   ├── rag/                # Chunking, ingestion, embeddings, retrieval, vector store
│   ├── subagents/          # Explorer, researcher, implementer, tester, reviewer
│   ├── tools/              # File, command, and web-search tool implementations
│   └── toolsDefinition.ts  # OpenAI tool schemas
├── package.json
└── tsconfig.json
```

Generated memory, task data, and RAG vectors live under `.agent-data/` according to the configured paths.

## Contributing and development

Before submitting a change:

```bash
npm install
npm run build
npm test
```

To add a RAG source, add a `file` or `url` entry to `rag.sources.json`, run `npx tsx src/rag/ingest.ts`, and confirm that the resulting vectors can be retrieved. Do not commit secrets or environment files.

Contribution checklist:

- Keep changes focused and consistent with the existing TypeScript style.
- Update documentation when behavior or configuration changes.
- Add or update tests for observable behavior.
- Run `npm run build` and `npm test` successfully.
- Review policy and telemetry implications for new tools.
- Avoid committing `.env`, credentials, or generated `.agent-data` content.

## License

License: ISC (replace or expand this placeholder with the project's final license text).

Report bugs and request features on the [GitHub issues page](https://github.com/XoaquinSanchezVarsallona/tools-agent/issues).
