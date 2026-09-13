import { beforeEach, describe, expect, it } from "vitest";
import {
  publishCanonicalShadowEvent,
  resetCanonicalShadowSubscribersForTest,
  subscribeCanonicalShadow,
} from "./canonicalShadow";
import { evaluateCanonicalShadowDiagnosticPolicy } from "./canonicalShadowDiagnosticPolicy";

const thresholds = {
  minDeliverySuccessRate: 0.9,
  minEquivalenceRate: 0.95,
  maxFailed: 0,
  maxDivergent: 0,
};

describe("MUE-013 política diagnóstica interna shadow", () => {
  beforeEach(() => {
    resetCanonicalShadowSubscribersForTest();
  });

  it("mantém idle sem violações quando ainda não houve publicações", () => {
    const result = evaluateCanonicalShadowDiagnosticPolicy({
      isTestMode: true,
      thresholds,
    });

    expect(result.status).toBe("idle");
    expect(result.violations).toEqual([]);
    expect(result.report.publications).toBe(0);
  });

  it("retorna healthy quando todas as métricas atendem aos limiares", async () => {
    subscribeCanonicalShadow(() => undefined);

    await publishCanonicalShadowEvent({
      canonicalEvent: { id: "evt_healthy" },
      equivalent: true,
    });

    const result = evaluateCanonicalShadowDiagnosticPolicy({
      isTestMode: true,
      thresholds,
    });

    expect(result.status).toBe("healthy");
    expect(result.violations).toEqual([]);
    expect(result.report.deliverySuccessRate).toBe(1);
    expect(result.report.equivalenceRate).toBe(1);
  });

  it("retorna warning com violações objetivas quando os limiares são ultrapassados", async () => {
    subscribeCanonicalShadow(() => undefined);
    subscribeCanonicalShadow(message => {
      if (!message.equivalent) throw new Error("falha shadow esperada");
    });

    await publishCanonicalShadowEvent({
      canonicalEvent: { id: "evt_ok" },
      equivalent: true,
    });
    await publishCanonicalShadowEvent({
      canonicalEvent: { id: "evt_warning" },
      equivalent: false,
    });

    const result = evaluateCanonicalShadowDiagnosticPolicy({
      isTestMode: true,
      thresholds,
    });

    expect(result.status).toBe("warning");
    expect(result.violations).toEqual([
      "deliverySuccessRate abaixo de minDeliverySuccessRate",
      "equivalenceRate abaixo de minEquivalenceRate",
      "failed acima de maxFailed",
      "divergent acima de maxDivergent",
    ]);
  });

  it("rejeita limiares inválidos", () => {
    expect(() => evaluateCanonicalShadowDiagnosticPolicy({
      isTestMode: true,
      thresholds: { ...thresholds, minEquivalenceRate: 1.1 },
    })).toThrow("minEquivalenceRate deve estar entre 0 e 1.");

    expect(() => evaluateCanonicalShadowDiagnosticPolicy({
      isTestMode: true,
      thresholds: { ...thresholds, maxFailed: -1 },
    })).toThrow("maxFailed deve ser um inteiro maior ou igual a zero.");
  });

  it("mantém o bloqueio da fronteira fora do modo teste", () => {
    expect(() => evaluateCanonicalShadowDiagnosticPolicy({
      isTestMode: false,
      thresholds,
    })).toThrow("Diagnóstico shadow disponível somente em modo teste.");
  });
});
