import {
  trackCanonicalShadowDiagnostic,
  type CanonicalShadowDiagnosticTrackingResult,
} from "./canonicalShadowDiagnosticTracker";
import type {
  CanonicalShadowDiagnosticPolicyResult,
  CanonicalShadowDiagnosticThresholds,
} from "./canonicalShadowDiagnosticPolicy";

export const MAX_CANONICAL_SHADOW_DIAGNOSTIC_SAMPLES = 20;

export interface CanonicalShadowDiagnosticHistorySample {
  sequence: number;
  recordedAt: string;
  evaluation: CanonicalShadowDiagnosticTrackingResult;
}

export interface CanonicalShadowDiagnosticHistorySummary {
  total: number;
  warnings: number;
  idle: number;
  degrading: number;
  improving: number;
  latestSequence: number | null;
}

let samples: CanonicalShadowDiagnosticHistorySample[] = [];
let sequence = 0;

function requireTestMode(isTestMode: boolean): void {
  if (!isTestMode) {
    throw new Error("Diagnóstico shadow disponível somente em modo teste.");
  }
}

function clonePolicyResult(
  result: CanonicalShadowDiagnosticPolicyResult
): CanonicalShadowDiagnosticPolicyResult {
  return {
    status: result.status,
    report: { ...result.report },
    violations: [...result.violations],
  };
}

function cloneEvaluation(
  evaluation: CanonicalShadowDiagnosticTrackingResult
): CanonicalShadowDiagnosticTrackingResult {
  return {
    baselineEstablished: evaluation.baselineEstablished,
    previous: evaluation.previous ? clonePolicyResult(evaluation.previous) : null,
    current: clonePolicyResult(evaluation.current),
    trend: evaluation.trend
      ? { trend: evaluation.trend.trend, reasons: [...evaluation.trend.reasons] }
      : null,
  };
}

function cloneSample(
  sample: CanonicalShadowDiagnosticHistorySample
): CanonicalShadowDiagnosticHistorySample {
  return {
    sequence: sample.sequence,
    recordedAt: sample.recordedAt,
    evaluation: cloneEvaluation(sample.evaluation),
  };
}

/**
 * Mantém no máximo 20 avaliações consecutivas do diagnóstico shadow.
 * Somente modo teste, sem persistência, timers, endpoints ou entrega de eventos.
 */
export function recordCanonicalShadowDiagnosticSample(input: {
  isTestMode: boolean;
  thresholds: CanonicalShadowDiagnosticThresholds;
}): CanonicalShadowDiagnosticHistorySample {
  const evaluation = trackCanonicalShadowDiagnostic(input);
  const entry: CanonicalShadowDiagnosticHistorySample = {
    sequence: ++sequence,
    recordedAt: new Date().toISOString(),
    evaluation: cloneEvaluation(evaluation),
  };
  samples.push(entry);
  if (samples.length > MAX_CANONICAL_SHADOW_DIAGNOSTIC_SAMPLES) {
    samples.splice(0, samples.length - MAX_CANONICAL_SHADOW_DIAGNOSTIC_SAMPLES);
  }
  return cloneSample(entry);
}

export function readCanonicalShadowDiagnosticHistory(input: {
  isTestMode: boolean;
}): ReadonlyArray<CanonicalShadowDiagnosticHistorySample> {
  requireTestMode(input.isTestMode);
  return samples.map(cloneSample);
}

export function summarizeCanonicalShadowDiagnosticHistory(input: {
  isTestMode: boolean;
}): CanonicalShadowDiagnosticHistorySummary {
  requireTestMode(input.isTestMode);
  return {
    total: samples.length,
    warnings: samples.filter(item => item.evaluation.current.status === "warning").length,
    idle: samples.filter(item => item.evaluation.current.status === "idle").length,
    degrading: samples.filter(item => item.evaluation.trend?.trend === "degrading").length,
    improving: samples.filter(item => item.evaluation.trend?.trend === "improving").length,
    latestSequence: samples.at(-1)?.sequence ?? null,
  };
}

/** Limpa somente a janela; o snapshot shadow e a baseline MUE-015 são independentes. */
export function resetCanonicalShadowDiagnosticHistoryForTest(): void {
  samples = [];
  sequence = 0;
}
