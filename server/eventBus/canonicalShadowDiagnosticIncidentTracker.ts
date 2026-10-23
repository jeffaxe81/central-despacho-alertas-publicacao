import {
  evaluateCanonicalShadowAlertSeverity,
  type CanonicalShadowAlertReason,
  type CanonicalShadowAlertSeverity,
} from "./canonicalShadowAlertSeverity";

/**
 * Estado volátil de um único diagnóstico shadow no processo de teste.
 * Não é um registro de ocorrências reais nem possui identificação multi-tenant.
 */
export interface CanonicalShadowDiagnosticIncident {
  id: number;
  status: "open" | "resolved";
  severity: "warning" | "critical";
  reasons: CanonicalShadowAlertReason[];
  violations: string[];
  firstSequence: number;
  lastSequence: number;
  openedAt: string;
  lastObservedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  suppressedObservations: number;
}

export type CanonicalShadowIncidentChange =
  | "none"
  | "opened"
  | "suppressed"
  | "escalated"
  | "deescalated"
  | "recovered"
  | "stale";

export interface CanonicalShadowIncidentObservation {
  change: CanonicalShadowIncidentChange;
  assessedSeverity: CanonicalShadowAlertSeverity;
  processedSequence: number | null;
  incident: CanonicalShadowDiagnosticIncident | null;
}

export interface CanonicalShadowIncidentState {
  active: CanonicalShadowDiagnosticIncident | null;
  lastResolved: CanonicalShadowDiagnosticIncident | null;
  lastProcessedSequence: number | null;
}

let active: CanonicalShadowDiagnosticIncident | null = null;
let lastResolved: CanonicalShadowDiagnosticIncident | null = null;
let lastProcessedSequence: number | null = null;
let nextId = 1;

function requireTestMode(isTestMode: boolean): void {
  if (!isTestMode) {
    throw new Error("Diagnóstico shadow disponível somente em modo teste.");
  }
}

function cloneIncident(
  incident: CanonicalShadowDiagnosticIncident | null
): CanonicalShadowDiagnosticIncident | null {
  if (!incident) return null;
  return {
    ...incident,
    reasons: [...incident.reasons],
    violations: [...incident.violations],
  };
}

function observation(
  change: CanonicalShadowIncidentChange,
  assessedSeverity: CanonicalShadowAlertSeverity,
  processedSequence: number | null,
  incident: CanonicalShadowDiagnosticIncident | null
): CanonicalShadowIncidentObservation {
  return { change, assessedSeverity, processedSequence, incident: cloneIncident(incident) };
}

/**
 * Transforma uma nova amostra da MUE-016 numa transição consultiva.
 * Uma mesma sequência nunca abre, reconhece, escala ou recupera duas vezes.
 * Sem filas, APIs, avisos externos, persistência ou efeito no dispatcher.
 */
export function observeCanonicalShadowDiagnosticIncident(input: {
  isTestMode: boolean;
  criticalAfterConsecutiveWarnings: number;
}): CanonicalShadowIncidentObservation {
  const assessment = evaluateCanonicalShadowAlertSeverity(input);
  const { lastSequence: seq, recordedAt: timestamp, severity } = assessment;

  if (seq === null || timestamp === null) {
    return observation("none", severity, lastProcessedSequence, active);
  }

  if (lastProcessedSequence !== null && seq < lastProcessedSequence) {
    // O histórico pode ter sido reiniciado: nunca reaproveitar seq antigo
    // sem um reset explícito deste rastreador, para evitar alertas duplicados.
    return observation("stale", severity, lastProcessedSequence, active);
  }

  if (seq === lastProcessedSequence) {
    return observation("suppressed", severity, lastProcessedSequence, active);
  }

  lastProcessedSequence = seq;

  if (severity === "idle") {
    // Ausência de dados não é prova de recuperação.
    return observation("none", severity, seq, active);
  }

  if (severity === "healthy") {
    if (!active) return observation("none", severity, seq, null);

    const resolved: CanonicalShadowDiagnosticIncident = {
      ...active,
      status: "resolved",
      lastSequence: seq,
      lastObservedAt: timestamp,
      resolvedAt: timestamp,
    };
    lastResolved = resolved;
    active = null;
    return observation("recovered", severity, seq, resolved);
  }

  if (!active) {
    const opened: CanonicalShadowDiagnosticIncident = {
      id: nextId++,
      status: "open",
      severity,
      reasons: [...assessment.reasons],
      violations: [...assessment.currentViolations],
      firstSequence: seq,
      lastSequence: seq,
      openedAt: timestamp,
      lastObservedAt: timestamp,
      acknowledgedAt: null,
      resolvedAt: null,
      suppressedObservations: 0,
    };
    active = opened;
    return observation("opened", severity, seq, opened);
  }

  const previousSeverity = active.severity;
  const change: CanonicalShadowIncidentChange =
    previousSeverity === severity
      ? "suppressed"
      : severity === "critical"
        ? "escalated"
        : "deescalated";

  active = {
    ...active,
    severity,
    reasons: [...assessment.reasons],
    violations: [...assessment.currentViolations],
    lastSequence: seq,
    lastObservedAt: timestamp,
    // Um agravamento requer novo reconhecimento; repetição e
    // redução de gravidade preservam o reconhecimento existente.
    acknowledgedAt: change === "escalated" ? null : active.acknowledgedAt,
    suppressedObservations: active.suppressedObservations +
      (change === "suppressed" ? 1 : 0),
  };
  return observation(change, severity, seq, active);
}

/** Reconhecimento apenas do incidente atualmente aberto. Idempotente. */
export function acknowledgeCanonicalShadowDiagnosticIncident(input: {
  isTestMode: boolean;
  incidentId: number;
}): boolean {
  requireTestMode(input.isTestMode);
  if (!Number.isInteger(input.incidentId) || input.incidentId < 1) return false;
  if (!active || active.id !== input.incidentId) return false;
  if (!active.acknowledgedAt) {
    active = { ...active, acknowledgedAt: new Date().toISOString() };
  }
  return true;
}

/** Cópia defensiva do estado interno atual: sem acesso a dados produtivos. */
export function readCanonicalShadowDiagnosticIncidentState(input: {
  isTestMode: boolean;
}): CanonicalShadowIncidentState {
  requireTestMode(input.isTestMode);
  return {
    active: cloneIncident(active),
    lastResolved: cloneIncident(lastResolved),
    lastProcessedSequence,
  };
}

/** Reset isolado: não reinicializa métricas, amostras ou baseline shadow. */
export function resetCanonicalShadowDiagnosticIncidentForTest(): void {
  active = null;
  lastResolved = null;
  lastProcessedSequence = null;
  nextId = 1;
}
