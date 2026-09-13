import type { CanonicalShadowDiagnosticPolicyResult } from "./canonicalShadowDiagnosticPolicy";

export type CanonicalShadowDiagnosticTrend = "stable" | "improving" | "degrading";

export interface CanonicalShadowDiagnosticTrendResult {
  trend: CanonicalShadowDiagnosticTrend;
  reasons: string[];
}

export function compareCanonicalShadowDiagnosticTrend(input: {
  previous: CanonicalShadowDiagnosticPolicyResult;
  current: CanonicalShadowDiagnosticPolicyResult;
}): CanonicalShadowDiagnosticTrendResult {
  const { previous, current } = input;

  if (previous.status === "idle" || current.status === "idle") {
    return {
      trend: "stable",
      reasons: ["sem base comparável suficiente"],
    };
  }

  const reasons: string[] = [];
  let improved = false;
  let worsened = false;

  const compareRate = (
    name: "deliverySuccessRate" | "equivalenceRate",
    previousValue: number | null,
    currentValue: number | null
  ) => {
    if (previousValue === null || currentValue === null) return;

    if (currentValue > previousValue) {
      improved = true;
      reasons.push(`${name} melhorou`);
    } else if (currentValue < previousValue) {
      worsened = true;
      reasons.push(`${name} piorou`);
    }
  };

  compareRate(
    "deliverySuccessRate",
    previous.report.deliverySuccessRate,
    current.report.deliverySuccessRate
  );
  compareRate(
    "equivalenceRate",
    previous.report.equivalenceRate,
    current.report.equivalenceRate
  );

  if (current.report.failed < previous.report.failed) {
    improved = true;
    reasons.push("failed reduziu");
  } else if (current.report.failed > previous.report.failed) {
    worsened = true;
    reasons.push("failed aumentou");
  }

  if (current.report.divergent < previous.report.divergent) {
    improved = true;
    reasons.push("divergent reduziu");
  } else if (current.report.divergent > previous.report.divergent) {
    worsened = true;
    reasons.push("divergent aumentou");
  }

  if (current.violations.length < previous.violations.length) {
    improved = true;
    reasons.push("violações reduziram");
  } else if (current.violations.length > previous.violations.length) {
    worsened = true;
    reasons.push("violações aumentaram");
  }

  return {
    trend: improved && !worsened
      ? "improving"
      : worsened && !improved
        ? "degrading"
        : "stable",
    reasons,
  };
}
