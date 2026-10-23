import {
  MAX_CANONICAL_SHADOW_DIAGNOSTIC_SAMPLES,
  readCanonicalShadowDiagnosticHistory,
  type CanonicalShadowDiagnosticHistorySample,
} from "./canonicalShadowDiagnosticHistory";

export type CanonicalShadowAlertSeverity = "idle" | "healthy" | "warning" | "critical";
export type CanonicalShadowAlertReason =
  | "policy_violation"
  | "degrading_trend"
  | "consecutive_warnings";

export interface CanonicalShadowAlertSeverityResult {
  severity: CanonicalShadowAlertSeverity;
  reasons: CanonicalShadowAlertReason[];
  currentViolations: string[];
  consecutiveWarnings: number;
  lastSequence: number | null;
  recordedAt: string | null;
  recoveredFromWarning: boolean;
}

function validateCriticalThreshold(value: number): void {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_CANONICAL_SHADOW_DIAGNOSTIC_SAMPLES
  ) {
    throw new Error(
      "criticalAfterConsecutiveWarnings deve ser um inteiro entre 1 e " +
        MAX_CANONICAL_SHADOW_DIAGNOSTIC_SAMPLES + "."
    );
  }
}

/**
 * Avaliação interna e puramente consultiva sobre a janela MUE-016.
 * Não cria amostras, tickets ou notificações e não toca no despacho produtivo.
 * warning -> critical ocorre exclusivamente após N avaliações consecutivas
 * com status warning; N é escolhido pelo chamador, nunca fixado pelo motor.
 */
export function evaluateCanonicalShadowAlertSeverity(input: {
  isTestMode: boolean;
  criticalAfterConsecutiveWarnings: number;
}): CanonicalShadowAlertSeverityResult {
  const history = readCanonicalShadowDiagnosticHistory({
    isTestMode: input.isTestMode,
  });
  validateCriticalThreshold(input.criticalAfterConsecutiveWarnings);

  const latest = history.at(-1);
  if (!latest) {
    return {
      severity: "idle",
      reasons: [],
      currentViolations: [],
      consecutiveWarnings: 0,
      lastSequence: null,
      recordedAt: null,
      recoveredFromWarning: false,
    };
  }

  let consecutiveWarnings = 0;
  for (let index = history.length - 1; index >= 0; index--) {
    const sample = history[index] as CanonicalShadowDiagnosticHistorySample;
    if (sample.evaluation.current.status !== "warning") break;
    consecutiveWarnings += 1;
  }

  const currentStatus = latest.evaluation.current.status;
  const previous = history.at(-2);
  const recoveredFromWarning = currentStatus === "healthy" &&
    previous?.evaluation.current.status === "warning";
  const reasons: CanonicalShadowAlertReason[] = [];

  let severity: CanonicalShadowAlertSeverity;
  if (currentStatus === "idle") {
    severity = "idle";
  } else if (currentStatus === "warning") {
    reasons.push("policy_violation");
    if (consecutiveWarnings >= input.criticalAfterConsecutiveWarnings) {
      reasons.push("consecutive_warnings");
      severity = "critical";
    } else {
      severity = "warning";
    }
  } else if (latest.evaluation.trend?.trend === "degrading") {
    severity = "warning";
    reasons.push("degrading_trend");
  } else {
    severity = "healthy";
  }

  return {
    severity,
    reasons,
    currentViolations: [...latest.evaluation.current.violations],
    consecutiveWarnings,
    lastSequence: latest.sequence,
    recordedAt: latest.recordedAt,
    recoveredFromWarning,
  };
}
