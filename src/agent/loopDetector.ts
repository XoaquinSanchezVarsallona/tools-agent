import type { ResponseInputItem } from "openai/resources/responses/responses";
import { AgentConfig } from "../policies/config";
import { TaskState, addObservation, incrementReplanCount } from "./taskState";

export interface LoopCheckResult {
    looping: boolean;
    reason?: string;
}

export interface LoopHandlingResult {
    shouldStop: boolean;
    stopMessage: string;
}

export function fingerprintArgs(args: unknown): string {
    try {
        return JSON.stringify(args);
    } catch {
        return String(args);
    }
}

/**
 * Detecta si las últimas N acciones (N = repeatedActionLimit) fueron
 * exactamente la misma tool, con los mismos args, y el mismo resultado.
 * Eso es la señal de "repetir un comando que produce el mismo error" o
 * "releer archivos sin obtener información nueva" que pide la consigna.
 */
export function checkForLoop(taskState: TaskState, config: AgentConfig): LoopCheckResult {
    const limit = config.loopDetection.repeatedActionLimit;
    const recent = taskState.recentActions;

    if (recent.length < limit) {
        return { looping: false };
    }

    const lastN = recent.slice(-limit);
    const [first, ...rest] = lastN;
    const allIdentical = rest.every(
        (a) =>
            a.tool === first.tool &&
            a.argsFingerprint === first.argsFingerprint &&
            a.outcomeFingerprint === first.outcomeFingerprint
    );

    if (allIdentical) {
        return {
            looping: true,
            reason: `Se repitió ${limit} vez/veces seguidas la misma acción (${first.tool}) con el mismo resultado, sin avanzar.`
        };
    }

    return { looping: false };
}

/**
 * Maneja un loop detectado: si todavía quedan replanificaciones disponibles
 * (config.loopDetection.replanLimit), le pide al agente que cambie de
 * estrategia y sigue. Si ya se agotaron, corta la ejecución y arma un
 * mensaje final explicando qué se intentó, qué falta y qué se necesita.
 */
export function handleLoopDetected(
    taskState: TaskState,
    config: AgentConfig,
    conversation: ResponseInputItem[],
    reason: string
): LoopHandlingResult {
    const replanLimit = config.loopDetection.replanLimit;

    if (taskState.replanCount >= replanLimit) {
        taskState.status = "blocked_insufficient_evidence";
        addObservation(
            taskState,
            `Loop detector: se alcanzó el límite de replanificaciones (${replanLimit}). El agente se detiene y pide ayuda.`,
            "blocker"
        );

        return {
            shouldStop: true,
            stopMessage: buildStopMessage(taskState, reason)
        };
    }

    incrementReplanCount(taskState);
    addObservation(
        taskState,
        `Loop detector: ${reason} Replanificación ${taskState.replanCount}/${replanLimit}.`,
        "warning"
    );

    conversation.push({
        role: "user",
        content:
            "Detecté que estás repitiendo la misma acción sin avanzar. Detenete, reconsiderá tu estrategia " +
            "y probá un enfoque distinto. Si no tenés la información necesaria para continuar, decilo " +
            "explícitamente en vez de reintentar lo mismo."
    });

    return { shouldStop: false, stopMessage: "" };
}

function buildStopMessage(taskState: TaskState, reason: string): string {
    const lastActions = taskState.recentActions
        .slice(-3)
        .map((a) => `${a.tool}(${a.argsFingerprint})`)
        .join(", ");

    return `
No puedo continuar con la estrategia actual.

Qué intenté: ${lastActions || "(sin registro de acciones)"}
Por qué me detuve: ${reason} Ya agoté los intentos de replanificación permitidos (${config_placeholder(taskState)}).
Qué me falta: no logré avanzar con la información y las acciones disponibles; puede que falte contexto,
que la acción esté bloqueada por una política de configuración, o que la tarea requiera un enfoque distinto.
Qué necesito: que me confirmes cómo proceder, me des más contexto, o ajustes el pedido original.
`.trim();
}

function config_placeholder(taskState: TaskState): string {
    return `${taskState.replanCount} replanificación(es) usada(s)`;
}