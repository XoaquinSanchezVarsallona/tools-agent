# tools-agent

CLI experimental de un coding agent con herramientas para inspeccionar archivos, escribir cambios y ejecutar comandos de terminal usando la API de OpenAI.

El agente mantiene una conversación interactiva por terminal y puede trabajar sobre el proyecto local con un modo de supervisión para pedir aprobación antes de acciones que modifican el sistema.

## Requisitos

- Node.js 20 o superior
- npm
- Una API key de OpenAI

## Instalación

```bash
npm install
```

Creá un archivo `.env` en la raíz del proyecto:

```bash
OPENAI_API_KEY=tu_api_key
```

## Ejecutar el CLI

Como el proyecto usa TypeScript, podés correr el entrypoint con `tsx`:

```bash
npx tsx src/index.ts
```

Al iniciar vas a ver los comandos disponibles y luego el prompt:

```text
Usuario:
```

Ahí podés pedirle tareas al agente en lenguaje natural.

## Comandos del CLI

| Comando | Descripción |
| --- | --- |
| `/orchestrator on` | Activa delegación adaptativa a subagentes para los próximos pedidos. |
| `/orchestrator off` | Vuelve al comportamiento normal del agente principal. |
| `/plan on` | Activa el modo planificación. El agente puede inspeccionar archivos y propone un plan sin ejecutar cambios. |
| `/plan off` | Vuelve al modo normal. |
| `/supervision on` | Activa confirmación manual antes de ejecutar herramientas que modifican el sistema. Es el modo inicial. |
| `/supervision off` | Permite que el agente ejecute herramientas modificadoras sin pedir confirmación. |
| `/exit` | Cierra el CLI. |

## Interacciones posibles

El agente puede ayudarte con tareas típicas de programación dentro del workspace. Por ejemplo:

```text
Usuario: listá los archivos del proyecto y explicame la estructura
Usuario: leé package.json y decime cómo se ejecuta este proyecto
Usuario: agregá un script npm para correr el CLI
Usuario: revisá src/agent/harness.ts y proponé mejoras
Usuario: ejecutá el typecheck y corregí los errores
```

Cuando la supervisión está activada, antes de usar herramientas como `write_file` o `run_command` vas a ver una confirmación:

```text
Acción supervisada:
El agente quiere ejecutar run_command con args: {
  "command": "npm test"
}
¿Permitir? [y/n]:
```

Respondé `y` para permitir la acción o `n` para rechazarla.

## Modo planificación

El modo planificación sirve cuando querés revisar el enfoque antes de que el agente toque archivos o ejecute comandos. En este modo solo están disponibles `read_file` y `list_files`:

```text
Usuario: /plan on
Usuario: agregá una tool para borrar archivos con confirmación
```

El agente va a inspeccionar el proyecto si hace falta y devolver un plan numerado. El turno termina normalmente, sin ejecutar el plan.

```text
Usuario: /plan off
Usuario: implementá el plan
```

El historial se conserva al cambiar de modo, por lo que el agente puede usar el plan anterior como contexto. `/plan off` es el paso explícito para volver a habilitar las tools de escritura y ejecución de comandos.

## Modo Orchestrator

El modo Orchestrator mantiene un historial separado y selecciona los subagentes necesarios
para cada pedido. Las tareas de implementación siempre pasan por Tester y Reviewer. Si
encuentran un problema concreto, el Orchestrator permite un único ciclo de reparación y
repite la verificación antes de sintetizar la respuesta final.

Durante el trabajo, el CLI muestra actualizaciones breves por etapa. Las políticas,
aprobaciones y el modo de supervisión siguen aplicándose a los subagentes que pueden
escribir archivos o ejecutar comandos. Plan mode continúa siendo exclusivo del modo normal.

## Herramientas disponibles

El agente tiene registradas estas tools:

| Tool | Qué hace |
| --- | --- |
| `read_file` | Lee el contenido de un archivo. |
| `write_file` | Escribe contenido completo en un archivo, reemplazando lo anterior. |
| `list_files` | Lista archivos y carpetas de un directorio. |
| `run_command` | Ejecuta comandos de terminal con timeout de 30 segundos. |

Por defecto, `write_file` y `run_command` requieren aprobación cuando la supervisión está activada.

## Desarrollo

El cliente de OpenAI está en `src/llm/client.ts` y toma la API key desde `OPENAI_API_KEY`.

El loop principal del CLI está en `src/index.ts`.

El harness del agente está en `src/agent/harness.ts`.

Las tools se definen en `src/toolsDefinition.ts` y se registran en `src/tools/index.ts`.

Para validar tipos:

```bash
npx tsc --noEmit
```

## Notas

- Este proyecto ejecuta comandos reales en la máquina local. Usá la supervisión activada si querés revisar cada acción sensible.
- `run_command` tiene un timeout de 30 segundos.
- `write_file` reemplaza el contenido completo del archivo indicado.
- El historial de conversación vive en memoria mientras el CLI está abierto; al cerrar el proceso se pierde.
