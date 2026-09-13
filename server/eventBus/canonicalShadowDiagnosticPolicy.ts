import {
  createCanonicalShadowDiagnosticReport,
  type CanonicalShadowDiagnosticReport,
} from "./canonicalShadowDiagnosticConsumer";

export interface CanonicalShadowDiagnosticThresholds {
  minDeliverySuccessRate: number;
  minEquivalenceRate: number;
  maxFailed: number;
  maxDivergent: number;
}

export interface CanonicalShadowDiagnosticPolicyResult {
  status: "idle" | "healthy" | "warning";
  report: CanonicalShadowDiagnosticReport;
  violations: string[];
}

function validateRate(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} deve estar entre 0 e 1.`);
  }
}

function validateCount(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} deve ser um inteiro maior ou igual a zero.`);
  }
}

export function evaluateCanonicalShadowDiagnosticPolicy(input: {
  isTestMode: boolean;
  thresholds: CanonicalShadowDiagnosticThresholds;
}): CanonicalShadowDiagnosticPolicyResult {
  const report = createCanonicalShadowDiagnosticReport({ isTestMode: input.isTestMode });
  const { thresholds } = input;

  validateRate("minDeliverySuccessRate", thresholds.minDeliverySuccessRate);
  validateRate("minEquivalenceRate", thresholds.minEquivalenceRate);
  validateCount("maxFailed", thresholds.maxFailed);
  validateCount("maxDivergent", thresholds.maxDivergent);

  if (report.status === "idle") {
    return { status: "idle", report, violations: [] };
  }

  const violations: string[] = [];

  if (
    report.deliverySuccessRate !== null &&
    report.deliverySuccessRate < thresholds.minDeliverySuccessRate
  ) {
    violations.push("deliverySuccessRate abaixo de minDeliverySuccessRate");
  }

  if (
    report.equivalenceRate !== null &&
    report.equivalenceRate < thresholds.minEquivalenceRate
  ) {
    violations.push("equivalenceRate abaixo de minEquivalenceRate");
  }

  if (report.failed > thresholds.maxFailed) {
    violations.push("failed acima de maxFailed");
  }

  if (report.divergent > thresholds.maxDivergent) {
    violations.push("divergent acima de maxDivergent");
  }

  return {
    status: violations.length === 0 ? "healthy" : "warning",
    report,
    violations,
  };
}
