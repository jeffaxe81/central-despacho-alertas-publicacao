import {
  evaluateCanonicalShadowDiagnosticPolicy,
  type CanonicalShadowDiagnosticPolicyResult,
  type CanonicalShadowDiagnosticThresholds,
} from "./canonicalShadowDiagnosticPolicy";
import {
  compareCanonicalShadowDiagnosticTrend,
  type CanonicalShadowDiagnosticTrendResult,
} from "./canonicalShadowDiagnosticTrend";

export interface CanonicalShadowDiagnosticTrackingResult {
  baselineEstablished: boolean;
  previous: CanonicalShadowDiagnosticPolicyResult | null;
  current: CanonicalShadowDiagnosticPolicyResult;
  trend: CanonicalShadowDiagnosticTrendResult | null;
}

let previousPolicyResult: CanonicalShadowDiagnosticPolicyResult | null = null;

export function trackCanonicalShadowDiagnostic(input: {
  isTestMode: boolean;
  thresholds: CanonicalShadowDiagnosticThresholds;
}): CanonicalShadowDiagnosticTrackingResult {
  const current = evaluateCanonicalShadowDiagnosticPolicy(input);
  const previous = previousPolicyResult;
  const trend = previous === null
    ? null
    : compareCanonicalShadowDiagnosticTrend({ previous, current });

  previousPolicyResult = current;

  return {
    baselineEstablished: previous === null,
    previous,
    current,
    trend,
  };
}

export function resetCanonicalShadowDiagnosticTrackerForTest() {
  previousPolicyResult = null;
}
