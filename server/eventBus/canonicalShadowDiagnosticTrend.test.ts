import { describe, expect, it } from "vitest";
import type { CanonicalShadowDiagnosticPolicyResult } from "./canonicalShadowDiagnosticPolicy";
import { compareCanonicalShadowDiagnosticTrend } from "./canonicalShadowDiagnosticTrend";

function createResult(input: {
  status?: CanonicalShadowDiagnosticPolicyResult["status"];
  deliverySuccessRate?: number | null;
  equivalenceRate?: number | null;
  failed?: number;
  divergent?: number;
  violations?: string[];
} = {}): CanonicalShadowDiagnosticPolicyResult {
  return {
    status: input.status ?? "healthy",
    violations: input.violations ?? [],
    report: {
      status: input.status === "idle" ? "idle" : "healthy",
      publications: input.status === "idle" ? 0 : 10,
      delivered: 10,
      failed: input.failed ?? 0,
      equivalent: 10,
      divergent: input.divergent ?? 0,
      deliverySuccessRate: input.deliverySuccessRate ?? 1,
      equivalenceRate: input.equivalenceRate ?? 1,
    },
  };
}

describe("MUE-014 tendência diagnóstica interna shadow", () => {
  it("retorna stable quando uma das leituras ainda está idle", () => {
    expect(compareCanonicalShadowDiagnosticTrend({
      previous: createResult({ status: "idle", deliverySuccessRate: null, equivalenceRate: null }),
      current: createResult(),
    })).toEqual({
      trend: "stable",
      reasons: ["sem base comparável suficiente"],
    });
  });

  it("retorna stable quando as métricas permanecem equivalentes", () => {
    expect(compareCanonicalShadowDiagnosticTrend({
      previous: createResult({ deliverySuccessRate: 0.95, equivalenceRate: 0.98 }),
      current: createResult({ deliverySuccessRate: 0.95, equivalenceRate: 0.98 }),
    })).toEqual({
      trend: "stable",
      reasons: [],
    });
  });

  it("retorna improving quando não há regressão e ao menos uma métrica melhora", () => {
    expect(compareCanonicalShadowDiagnosticTrend({
      previous: createResult({
        status: "warning",
        deliverySuccessRate: 0.8,
        equivalenceRate: 0.9,
        failed: 2,
        divergent: 1,
        violations: ["delivery", "equivalence", "failed", "divergent"],
      }),
      current: createResult({
        status: "warning",
        deliverySuccessRate: 0.9,
        equivalenceRate: 0.95,
        failed: 1,
        divergent: 0,
        violations: ["delivery", "failed"],
      }),
    })).toEqual({
      trend: "improving",
      reasons: [
        "deliverySuccessRate melhorou",
        "equivalenceRate melhorou",
        "failed reduziu",
        "divergent reduziu",
        "violações reduziram",
      ],
    });
  });

  it("retorna degrading quando não há melhora e ao menos uma métrica piora", () => {
    expect(compareCanonicalShadowDiagnosticTrend({
      previous: createResult({ deliverySuccessRate: 1, equivalenceRate: 1 }),
      current: createResult({
        status: "warning",
        deliverySuccessRate: 0.75,
        equivalenceRate: 0.8,
        failed: 2,
        divergent: 2,
        violations: ["delivery", "equivalence", "failed", "divergent"],
      }),
    })).toEqual({
      trend: "degrading",
      reasons: [
        "deliverySuccessRate piorou",
        "equivalenceRate piorou",
        "failed aumentou",
        "divergent aumentou",
        "violações aumentaram",
      ],
    });
  });

  it("retorna stable quando há sinais mistos de melhora e piora", () => {
    expect(compareCanonicalShadowDiagnosticTrend({
      previous: createResult({ deliverySuccessRate: 0.8, equivalenceRate: 1 }),
      current: createResult({ deliverySuccessRate: 0.9, equivalenceRate: 0.9 }),
    })).toEqual({
      trend: "stable",
      reasons: [
        "deliverySuccessRate melhorou",
        "equivalenceRate piorou",
      ],
    });
  });
});
