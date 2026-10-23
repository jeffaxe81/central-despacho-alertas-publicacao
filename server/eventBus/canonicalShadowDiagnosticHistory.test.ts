import { beforeEach, describe, expect, it } from "vitest";
import {
  publishCanonicalShadowEvent,
  resetCanonicalShadowSubscribersForTest,
  subscribeCanonicalShadow,
} from "./canonicalShadow";
import {
  resetCanonicalShadowDiagnosticTrackerForTest,
} from "./canonicalShadowDiagnosticTracker";
import {
  MAX_CANONICAL_SHADOW_DIAGNOSTIC_SAMPLES,
  readCanonicalShadowDiagnosticHistory,
  recordCanonicalShadowDiagnosticSample,
  resetCanonicalShadowDiagnosticHistoryForTest,
  summarizeCanonicalShadowDiagnosticHistory,
} from "./canonicalShadowDiagnosticHistory";

const thresholds = {
  minDeliverySuccessRate: 0.9,
  minEquivalenceRate: 0.95,
  maxFailed: 0,
  maxDivergent: 0,
};

const sample = () => recordCanonicalShadowDiagnosticSample({
  isTestMode: true,
  thresholds,
});

describe("MUE-016 histórico diagnóstico interno shadow em janela limitada", () => {
  beforeEach(() => {
    resetCanonicalShadowSubscribersForTest();
    resetCanonicalShadowDiagnosticTrackerForTest();
    resetCanonicalShadowDiagnosticHistoryForTest();
  });

  it("guarda baseline e tendência sem interferir na entrega shadow", async () => {
    subscribeCanonicalShadow(() => undefined);
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "ok" }, equivalent: true });
    const first = sample();
    expect(first.sequence).toBe(1);
    expect(first.evaluation.baselineEstablished).toBe(true);
    expect(first.evaluation.current.status).toBe("healthy");

    subscribeCanonicalShadow(() => { throw new Error("falha simulada"); });
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "bad" }, equivalent: false });
    const second = sample();

    expect(second.sequence).toBe(2);
    expect(second.evaluation.baselineEstablished).toBe(false);
    expect(second.evaluation.current.status).toBe("warning");
    expect(second.evaluation.trend?.trend).toBe("degrading");
    expect(summarizeCanonicalShadowDiagnosticHistory({ isTestMode: true })).toEqual({
      total: 2,
      warnings: 1,
      idle: 0,
      degrading: 1,
      improving: 0,
      latestSequence: 2,
    });
  });

  it("limita a memória às últimas 20 amostras, preservando a sequência", () => {
    for (let index = 0; index < MAX_CANONICAL_SHADOW_DIAGNOSTIC_SAMPLES + 3; index++) {
      sample();
    }
    const entries = readCanonicalShadowDiagnosticHistory({ isTestMode: true });
    expect(entries).toHaveLength(20);
    expect(entries[0]?.sequence).toBe(4);
    expect(entries.at(-1)?.sequence).toBe(23);
    expect(summarizeCanonicalShadowDiagnosticHistory({ isTestMode: true }).idle).toBe(20);
  });

  it("devolve cópias defensivas em gravações e consultas", async () => {
    subscribeCanonicalShadow(() => undefined);
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "ok" }, equivalent: true });

    const entry = sample();
    entry.evaluation.current.violations.push("injetada");
    entry.evaluation.current.report.failed = 999;

    const read = readCanonicalShadowDiagnosticHistory({ isTestMode: true });
    expect(read[0]?.evaluation.current.violations).toEqual([]);
    expect(read[0]?.evaluation.current.report.failed).toBe(0);

    read[0]!.evaluation.current.violations.push("outra");
    expect(readCanonicalShadowDiagnosticHistory({ isTestMode: true })[0]?.evaluation.current.violations).toEqual([]);
  });

  it("rejeita leitura e escrita fora do modo teste", () => {
    expect(() => readCanonicalShadowDiagnosticHistory({ isTestMode: false }))
      .toThrow("Diagnóstico shadow disponível somente em modo teste.");
    expect(() => summarizeCanonicalShadowDiagnosticHistory({ isTestMode: false }))
      .toThrow("Diagnóstico shadow disponível somente em modo teste.");
    expect(() => recordCanonicalShadowDiagnosticSample({
      isTestMode: false, thresholds,
    })).toThrow("Diagnóstico shadow disponível somente em modo teste.");
    expect(readCanonicalShadowDiagnosticHistory({ isTestMode: true })).toEqual([]);
  });

  it("limiares inválidos não incrementam a sequência nem escrevem histórico", () => {
    expect(() => recordCanonicalShadowDiagnosticSample({
      isTestMode: true,
      thresholds: { ...thresholds, minEquivalenceRate: 10 },
    })).toThrow("minEquivalenceRate deve estar entre 0 e 1.");
    expect(sample().sequence).toBe(1);
  });

  it("reset limpa somente a janela, mantendo snapshot e baseline independentes", async () => {
    subscribeCanonicalShadow(() => undefined);
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "ok" }, equivalent: true });
    sample();
    resetCanonicalShadowDiagnosticHistoryForTest();

    expect(readCanonicalShadowDiagnosticHistory({ isTestMode: true })).toEqual([]);
    expect(summarizeCanonicalShadowDiagnosticHistory({ isTestMode: true }).latestSequence).toBeNull();
    const afterReset = sample();
    expect(afterReset.sequence).toBe(1);
    expect(afterReset.evaluation.baselineEstablished).toBe(false);
    expect(afterReset.evaluation.current.report.publications).toBe(1);
  });
});
