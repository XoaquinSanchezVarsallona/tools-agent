# tools-agent

CLI experimental de coding agent y primera version de un agente especializado en generar componentes React con RAG local, Storybook y Langfuse.

## Requisitos

- Node.js 20 o superior
- npm
- Una API key de OpenAI
- Credenciales de Langfuse si se quiere enviar trazas

## Instalacion

```bash
npm install
```

Crea un archivo `.env` en la raiz del proyecto:

```bash
OPENAI_API_KEY=tu_api_key
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

`LANGFUSE_PUBLIC_KEY` y `LANGFUSE_SECRET_KEY` son opcionales para ejecuciones locales: si faltan, el agente corre con trazas desactivadas y lo informa en el resumen.

## Agente de componentes

Primero genera el indice local del RAG:

```bash
npm run rag:ingest
```

Ejecuta la prueba del componente `Button`:

```bash
npm run agent -- "Genera un boton para una aplicacion financiera"
```

La ejecucion hace este flujo:

```text
pedido del usuario
-> recuperacion de documentos del RAG
-> generacion de Button.tsx, Button.css y Button.stories.tsx
-> build de Storybook
-> traza en Langfuse
-> resumen final con fuentes utilizadas
```

Los archivos generados quedan en:

```text
src/components/generated/Button/
```

## Storybook

Para levantar Storybook:

```bash
npm run storybook
```

Para validar el build:

```bash
npm run build-storybook
```

## CLI general existente

El coding agent interactivo original se mantiene:

```bash
npx tsx src/index.ts
```

Comandos disponibles:

| Comando | Descripcion |
| --- | --- |
| `/plan on` | Activa modo planificacion. |
| `/plan off` | Vuelve al modo normal. |
| `/supervision on` | Pide confirmacion antes de herramientas modificadoras. |
| `/supervision off` | Permite herramientas modificadoras sin confirmacion manual. |
| `/exit` | Cierra el CLI. |

## Validacion

```bash
npm run typecheck
npm run build-storybook
```

El build de Storybook debe finalizar sin errores despues de ejecutar `npm run agent`.
