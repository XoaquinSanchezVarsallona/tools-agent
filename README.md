# Coding Agent Avanzado para TypeScript/Node

Agente construido sobre OpenAI Responses API, sin frameworks de orquestación. Coordina cinco subagentes, aplica políticas antes de cada tool, conserva memoria por proyecto, consulta un RAG local y registra trazas opcionales en Langfuse.

## Instalación y ejecución

Requiere Node.js 20 o superior.

```bash
npm install
copy .env.example .env
npm run build
npm test
npm run rag:index
npm start
```

Configure `OPENAI_API_KEY`. Para trazas, configure `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` y `LANGFUSE_BASE_URL`. Sin Langfuse el agente sigue funcionando.

## Caso de uso y arquitectura

El sistema analiza y modifica repositorios TypeScript/Node. El coordinador ejecuta `Explorer → Researcher → Implementer → Tester → Reviewer` y persiste el estado después de cada etapa. Explorer releva el proyecto; Researcher consulta memoria y RAG antes de la web; Implementer es el único que escribe; Tester ejecuta checks; Reviewer inspecciona el resultado.

Las tools tienen nombre, descripción, JSON Schema, validador, efecto, roles permitidos y ejecución. `PolicyService` valida paths y comandos antes de ejecutarlos. La configuración vive en `agent.config.json`.

## Memoria, RAG y contexto

`.agent-data/` guarda memoria, tareas y vectores y está excluido de Git. `rag.sources.json` declara archivos y URLs. `npm run rag:index` genera chunks de 1200 caracteres con 200 de solapamiento, embeddings `text-embedding-3-small` y un índice JSON con similitud coseno. Las evidencias se etiquetan `repository`, `memory`, `rag`, `web` o `inference`.

Si una acción y resultado se repiten, el agente exige un cambio de estrategia y luego se bloquea explicando la falta de progreso.

## CLI

- `/plan on|off`: planificación con reaprobación de cambios.
- `/supervision on|off`: confirmaciones configuradas.
- `/rag index`, `/memory`, `/status`, `/config`.
- `/help`, `/exit`.

## Seguridad y observabilidad

Por defecto se impide leer `.env`, secretos y certificados; modificar lockfiles, `.env`, `.git` o workflows; y ejecutar comandos destructivos o `git push`. Instalaciones y commits requieren aprobación.

Cada tarea puede crear una traza Langfuse con llamadas al LLM, tools, argumentos, resultados, uso, fuentes, errores, iteraciones y resultado final. La telemetría es tolerante a fallos.

`npm test` compila y ejecuta pruebas sin red para políticas, memoria, chunking, ranking, tools y roles. Los escenarios de entrega están en [docs/ENTREGA.md](docs/ENTREGA.md).
