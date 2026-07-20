# Coding Agent Multiagente

Trabajo final de Inteligencia Artificial. Evoluciona el coding agent construido en clase para generar componentes React aislados con Storybook, RAG local, memoria de proyecto, politicas de seguridad, subagentes y observabilidad.

No usa frameworks de orquestacion. El agente principal y los subagentes estan implementados sobre el harness original y la Responses API.

## Instalacion

Requiere Node.js 20 o superior.

```bash
npm install
```

Variables de entorno en `.env`:

```bash
OPENAI_API_KEY=tu_api_key
OPENAI_MODEL=gpt-5.2
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

`OPENAI_MODEL` es opcional. Langfuse tambien es opcional para desarrollo local; si faltan sus credenciales, el agente corre sin enviar trazas.

## Ejecucion

Los dos scripts abren el mismo CLI interactivo basado en `src/index.ts`:

```bash
npm start
npm run agent
```

Ejemplo de pedido:

```text
Genera una card de producto para una aplicacion financiera
```

Comandos del CLI:

| Comando | Funcion |
| --- | --- |
| `/plan on` | Ejecuta solo exploracion, investigacion y plan. |
| `/plan off` | Activa el flujo completo. |
| `/supervision on` | Solicita confirmacion para tools modificadoras. |
| `/supervision off` | Usa solamente las aprobaciones obligatorias de la configuracion. |
| `/exit` | Cierra el CLI y envia las trazas pendientes. |

La consola muestra solamente la respuesta final y las confirmaciones de seguridad necesarias. El detalle de la ultima ejecucion se guarda en `.agent/last-run.json`.

## Arquitectura

El agente principal recibe el pedido, crea un estado compartido y coordina cinco subagentes secuenciales:

1. **Explorer**: inspecciona estructura, dependencias, estilos, scripts, convenciones y archivos relevantes.
2. **Researcher**: consulta primero el RAG cuando el pedido requiere evidencia de diseno y usa busqueda web solo si resulta insuficiente.
3. **Implementer**: realiza el cambio solicitado respetando la arquitectura, las librerias y los estilos existentes.
4. **Tester**: ejecuta solamente las validaciones relevantes disponibles en el proyecto.
5. **Reviewer**: revisa los archivos, el pedido, las fuentes y los resultados de validacion.

Si Tester o Reviewer detectan un problema, se permite un unico ciclo adicional de Implementer, Tester y Reviewer. Una segunda falla deja la tarea en estado `blocked`.

Cada subagente reutiliza el mismo loop del harness, pero recibe instrucciones y tools diferentes. El estado registra pedido, etapa, resultados, fuentes, archivos modificados, comandos, errores y si hubo reparacion.

## Memoria y contexto

La memoria persistente se guarda en `.agent/memory.json` y no se versiona. Conserva solamente componentes generados, comandos utiles, archivos importantes, convenciones y el resumen de la ultima tarea.

Los subagentes reciben el pedido, la memoria y un resumen del estado compartido. No reciben todo el repositorio ni todo el historial. El CLI conserva como maximo los ultimos seis intercambios.

Una tool no puede repetir dos veces la misma llamada dentro de una etapa sin avanzar. Cada subagente tiene ademas un limite de ocho iteraciones.

## RAG y fuentes

Las fuentes Markdown estan en `rag/sources/`. El proceso divide los documentos en chunks deterministas, obtiene embeddings con OpenAI y guarda el indice vectorial local en `rag/index.json`.

```bash
npm run rag:ingest
```

Researcher usa `rag_search` antes de `web_search`. El RAG se considera suficiente cuando recupera al menos dos chunks y el mejor score es igual o mayor a `0.35`.

El registro `.agent/last-run.json` diferencia fuentes del repositorio, memoria, RAG y web, e incluye las URLs recuperadas.

## Seguridad

`agent.config.json` se valida al comenzar cada tarea y antes de ejecutar las tools se aplican sus politicas:

- no leer `.env`, `secrets/**` ni certificados PEM;
- no escribir fuera del workspace, `.github/**`, `.env`, `secrets/**` ni `package-lock.json`;
- no ejecutar `rm -rf` ni `git push`;
- pedir aprobacion para instalaciones y commits.

Las rutas se resuelven contra el workspace para bloquear escapes con `../`.

## Observabilidad

Langfuse registra una traza por pedido. La traza incluye el agente principal, cada subagente, llamadas al modelo, tools, documentos RAG, busquedas web, comandos, errores, latencia, uso del modelo y resultado final.

Para la entrega se debe ejecutar al menos una tarea con las credenciales de Langfuse configuradas y adjuntar una captura de la traza completa.

## Validacion y evidencia

No se agregan tests automatizados. La validacion tecnica es:

```bash
npm run typecheck
npm run build-storybook
```

Tareas sugeridas para las dos evidencias de la entrega:

1. `Genera un boton de confirmacion para una aplicacion financiera siguiendo Material Design.` Debe mostrar chunks del RAG, archivos generados y build exitoso.
2. Repetir una mejora sobre ese componente en otra sesion. Debe mostrar la memoria previa; alternativamente, hacer un pedido sin evidencia suficiente para demostrar web fallback o detencion explicada.

Para cada evidencia usar `.agent/last-run.json`, que contiene el pedido, intencion detectada, resultados de subagentes, fuentes, archivos, comandos y errores.

## Storybook

```bash
npm run storybook
npm run build-storybook
```

Los componentes generados quedan en:

```text
src/components/generated/{ComponentName}/
```
