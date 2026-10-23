import { beforeEach, describe, expect, it } from "vitest";
import {
  publishCanonicalShadowEvent,
  resetCanonicalShadowSubscribersForTest,
  subscribeCanonicalShadow,
} from "./canonicalShadow";
import {
  readCanonicalShadowDiagnosticHistory,
  recordCanonicalShadowDiagnosticSample,
  resetCanonicalShadowDiagnosticHistoryForTest,
} from "./canonicalShadowDiagnosticHistory";
import { resetCanonicalShadowDiagnosticTrackerForTest } from "./canonicalShadowDiagnosticTracker";
import { evaluateCanonicalShadowAlertSeverity } from "./canonicalShadowAlertSeverity";

const strictThresholds = {
  minDeliverySuccessRate: 0.9,
  minEquivalenceRate: 0.95,
  maxFailed: 0,
  maxDivergent: 0,
};
const permissiveThresholds = {
  minDeliverySuccessRate: 0,
  minEquivalenceRate: 0,
  maxFailed: 10,
  maxDivergent: 10,
};
const sample = (thresholds = strictThresholds) =>
  recordCanonicalShadowDiagnosticSample({ isTestMode: true, thresholds });
const evaluate = (limit = 3) => evaluateCanonicalShadowAlertSeverity({
  isTestMode: true,
  criticalAfterConsecutiveWarnings: limit,
});

describe("MUE-017 criticidade diagnóstica shadow somente em modo teste", () => {
  beforeEach(() => {
    resetCanonicalShadowSubscribersForTest();
    resetCanonicalShadowDiagnosticTrackerForTest();
    resetCanonicalShadowDiagnosticHistoryForTest();
  });

  it("distingue janela sem amostras e amostra sem eventos de saúde real", () => {
    expect(evaluate()).toEqual({
      severity: "idle", reasons: [], currentViolations: [],
      consecutiveWarnings: 0, lastSequence: null, recordedAt: null,
      recoveredFromWarning: false,
    });
    const entry = sample();
    expect(evaluate()).toMatchObject({
      severity: "idle", consecutiveWarnings: 0,
      lastSequence: entry.sequence, recordedAt: entry.recordedAt,
    });
  });

  it("mantém saudável o último diagnóstico sem violações ou degradação", async () => {
    subscribeCanonicalShadow(() => undefined);
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "ok" }, equivalent: true });
    sample();
    expect(evaluate()).toMatchObject({
      severity: "healthy", reasons: [], consecutiveWarnings: 0,
      currentViolations: [], recoveredFromWarning: false,
    });
  });

  it("gera warning pela política e eleva a critical com 3 avaliações consecutivas", async () => {
    subscribeCanonicalShadow(() => { throw new Error("falha de teste"); });
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "bad" }, equivalent: false });
    sample();
    expect(evaluate()).toMatchObject({
      severity: "warning", reasons: ["policy_violation"], consecutiveWarnings: 1,
    });
    sample();
    expect(evaluate()).toMatchObject({ severity: "warning", consecutiveWarnings: 2 });
    sample();
    expect(evaluate()).toMatchObject({
      severity: "critical",
      reasons: ["policy_violation", "consecutive_warnings"],
      consecutiveWarnings: 3,
    });
    expect(evaluate(4).severity).toBe("warning");
  });

  it("sinaliza degradação antecipada mesmo antes de exceder os limiares", async () => {
    subscribeCanonicalShadow(() => undefined);
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "ok" }, equivalent: true });
    sample(permissiveThresholds);
    subscribeCanonicalShadow(() => { throw new Error("falha de teste"); });
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "misto" }, equivalent: true });
    sample(permissiveThresholds);
    expect(readCanonicalShadowDiagnosticHistory({ isTestMode: true }).at(-1)?.evaluation.current.status)
      .toBe("healthy");
    expect(evaluate()).toMatchObject({
      severity: "warning", reasons: ["degrading_trend"], consecutiveWarnings: 0,
      currentViolations: [],
    });
  });

  it("reconhece recuperação quando o warning anterior dá lugar a healthy", async () => {
    subscribeCanonicalShadow(() => { throw new Error("falha de teste"); });
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "bad" }, equivalent: false });
    sample();
    sample(permissiveThresholds);
    expect(evaluate()).toMatchObject({
      severity: "healthy", reasons: [], consecutiveWarnings: 0,
      recoveredFromWarning: true,
    });
    sample(permissiveThresholds);
    expect(evaluate().recoveredFromWarning).toBe(false);
  });

  it("considera apenas a janela recente de 20 amostras para recorrência", async () => {
    subscribeCanonicalShadow(() => { throw new Error("falha de teste"); });
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "bad" }, equivalent: false });
    for (let i = 0; i < 23; i++) sample();
    expect(readCanonicalShadowDiagnosticHistory({ isTestMode: true })).toHaveLength(20);
    expect(evaluate(20)).toMatchObject({
      severity: "critical", consecutiveWarnings: 20, lastSequence: 23,
    });
  });

  it("não expõe histórico em modo produtivo nem aceita configuração inválida", () => {
    expect(() => evaluateCanonicalShadowAlertSeverity({
      isTestMode: false,
      criticalAfterConsecutiveWarnings: 3,
    })).toThrow("Diagnóstico shadow disponível somente em modo teste.");
    for (const limit of [0, 21, 1.5, Number.NaN]) {
      expect(() => evaluate(limit)).toThrow(
        "criticalAfterConsecutiveWarnings deve ser um inteiro entre 1 e 20."
      );
    }
    expect(readCanonicalShadowDiagnosticHistory({ isTestMode: true })).toHaveLength(0);
  });

  it("é leitura pura: não cria amostra, não muda baseline e não altera a avaliação anterior", async () => {
    subscribeCanonicalShadow(() => undefined);
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "ok" }, equivalent: true });
    sample();
    const before = readCanonicalShadowDiagnosticHistory({ isTestMode: true });
    const result = evaluate();
    result.currentViolations.push("alteração externa");
    expect(readCanonicalShadowDiagnosticHistory({ isTestMode: true })).toEqual(before);
    expect(evaluate().currentViolations).toEqual([]);
    expect(sample().evaluation.baselineEstablished).toBe(false);
  });
});
