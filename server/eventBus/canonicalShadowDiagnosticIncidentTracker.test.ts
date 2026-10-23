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
import {
  acknowledgeCanonicalShadowDiagnosticIncident,
  observeCanonicalShadowDiagnosticIncident,
  readCanonicalShadowDiagnosticIncidentState,
  resetCanonicalShadowDiagnosticIncidentForTest,
} from "./canonicalShadowDiagnosticIncidentTracker";

const strict = {
  minDeliverySuccessRate: 0.9,
  minEquivalenceRate: 0.95,
  maxFailed: 0,
  maxDivergent: 0,
};
const permissive = {
  minDeliverySuccessRate: 0,
  minEquivalenceRate: 0,
  maxFailed: 10,
  maxDivergent: 10,
};
const sample = (thresholds = strict) =>
  recordCanonicalShadowDiagnosticSample({ isTestMode: true, thresholds });
const observe = (limit = 3) =>
  observeCanonicalShadowDiagnosticIncident({
    isTestMode: true, criticalAfterConsecutiveWarnings: limit,
  });
const state = () => readCanonicalShadowDiagnosticIncidentState({ isTestMode: true });

async function createFailure() {
  subscribeCanonicalShadow(() => { throw new Error("falha de teste"); });
  await publishCanonicalShadowEvent({ canonicalEvent: { id: "bad" }, equivalent: false });
}

describe("MUE-018 controle interno de incidentes shadow e deduplicação", () => {
  beforeEach(() => {
    resetCanonicalShadowSubscribersForTest();
    resetCanonicalShadowDiagnosticTrackerForTest();
    resetCanonicalShadowDiagnosticHistoryForTest();
    resetCanonicalShadowDiagnosticIncidentForTest();
  });

  it("não inventa incidente em janela vazia ou diagnóstico idle", () => {
    expect(observe()).toMatchObject({
      change: "none", assessedSeverity: "idle", incident: null, processedSequence: null,
    });
    sample();
    expect(observe()).toMatchObject({
      change: "none", assessedSeverity: "idle", incident: null, processedSequence: 1,
    });
    expect(state().active).toBeNull();
  });

  it("abre uma única ocorrência por amostra e bloqueia repetição da mesma sequência", async () => {
    await createFailure();
    const entry = sample();
    const first = observe();
    expect(first).toMatchObject({
      change: "opened", assessedSeverity: "warning", processedSequence: 1,
      incident: { id: 1, firstSequence: 1, lastSequence: 1, status: "open" },
    });
    expect(first.incident?.openedAt).toBe(entry.recordedAt);
    expect(observe()).toMatchObject({
      change: "suppressed", processedSequence: 1, incident: { id: 1 },
    });
    expect(state().active?.suppressedObservations).toBe(0);
    expect(readCanonicalShadowDiagnosticHistory({ isTestMode: true })).toHaveLength(1);
  });

  it("suprime amostras consecutivas com mesma gravidade e mantém o mesmo ID", async () => {
    await createFailure();
    sample(); observe();
    sample();
    const duplicate = observe();
    expect(duplicate).toMatchObject({
      change: "suppressed", incident: { id: 1, severity: "warning",
        suppressedObservations: 1, lastSequence: 2 },
    });
    expect(state().active?.firstSequence).toBe(1);
  });

  it("permite reconhecimento idempotente e limpa reconhecimento em escalonamento", async () => {
    await createFailure();
    sample(); observe();
    expect(acknowledgeCanonicalShadowDiagnosticIncident({
      isTestMode: true, incidentId: 2,
    })).toBe(false);
    expect(acknowledgeCanonicalShadowDiagnosticIncident({
      isTestMode: true, incidentId: 1,
    })).toBe(true);
    const acknowledgedAt = state().active?.acknowledgedAt;
    expect(acknowledgedAt).toEqual(expect.any(String));
    expect(acknowledgeCanonicalShadowDiagnosticIncident({
      isTestMode: true, incidentId: 1,
    })).toBe(true);
    expect(state().active?.acknowledgedAt).toBe(acknowledgedAt);

    sample(); observe();
    expect(state().active?.acknowledgedAt).toBe(acknowledgedAt);
    sample();
    expect(observe()).toMatchObject({
      change: "escalated", assessedSeverity: "critical",
      incident: { id: 1, severity: "critical", acknowledgedAt: null, lastSequence: 3 },
    });
  });

  it("reduz gravidade sem abrir novo incidente nem perder reconhecimento", async () => {
    await createFailure();
    sample(); observe();
    sample(); observe();
    sample(); observe(); // crítico com limiar 3
    expect(state().active?.severity).toBe("critical");
    expect(acknowledgeCanonicalShadowDiagnosticIncident({
      isTestMode: true, incidentId: 1,
    })).toBe(true);
    const ack = state().active?.acknowledgedAt;
    sample();
    const reduced = observe(5);
    expect(reduced).toMatchObject({
      change: "deescalated", assessedSeverity: "warning",
      incident: { id: 1, severity: "warning", acknowledgedAt: ack },
    });
  });

  it("registra recuperação, guarda a última resolvida e permite novo incidente depois", async () => {
    await createFailure();
    sample(); observe();
    sample(permissive);
    const recovered = observe();
    expect(recovered).toMatchObject({
      change: "recovered", assessedSeverity: "healthy",
      incident: { id: 1, status: "resolved", resolvedAt: expect.any(String) },
    });
    expect(state()).toMatchObject({
      active: null, lastResolved: { id: 1, status: "resolved" },
      lastProcessedSequence: 2,
    });
    expect(acknowledgeCanonicalShadowDiagnosticIncident({
      isTestMode: true, incidentId: 1,
    })).toBe(false);

    sample();
    expect(observe()).toMatchObject({
      change: "opened", incident: { id: 2, status: "open" },
    });
    expect(state().lastResolved?.id).toBe(1);
  });

  it("não processa duas vezes a amostra já resolvida", async () => {
    await createFailure();
    sample(); observe();
    sample(permissive); observe();
    expect(observe()).toMatchObject({
      change: "suppressed", assessedSeverity: "healthy",
      incident: null,
    });
    expect(state().lastResolved?.id).toBe(1);
  });

  it("resiste a números de sequência regressivos após reset do histórico", async () => {
    await createFailure();
    sample(); observe();
    sample(); observe();
    const before = state();
    resetCanonicalShadowDiagnosticHistoryForTest();
    sample();
    expect(observe()).toMatchObject({
      change: "stale", processedSequence: 2, incident: { id: 1 },
    });
    expect(state()).toEqual(before);
    resetCanonicalShadowDiagnosticIncidentForTest();
    expect(observe()).toMatchObject({ change: "opened", incident: { id: 1 } });
  });

  it("não permite acesso fora do modo teste nem altera estado em configuração inválida", async () => {
    await createFailure();
    sample();
    expect(() => observeCanonicalShadowDiagnosticIncident({
      isTestMode: false, criticalAfterConsecutiveWarnings: 3,
    })).toThrow("Diagnóstico shadow disponível somente em modo teste.");
    expect(() => observe(21)).toThrow(
      "criticalAfterConsecutiveWarnings deve ser um inteiro entre 1 e 20."
    );
    expect(state().active).toBeNull();
    expect(state().lastProcessedSequence).toBeNull();
    expect(() => readCanonicalShadowDiagnosticIncidentState({
      isTestMode: false,
    })).toThrow("Diagnóstico shadow disponível somente em modo teste.");
    expect(() => acknowledgeCanonicalShadowDiagnosticIncident({
      isTestMode: false, incidentId: 1,
    })).toThrow("Diagnóstico shadow disponível somente em modo teste.");
  });

  it("retorna cópias defensivas da ocorrência, inclusive razões e violações", async () => {
    await createFailure();
    sample();
    const opened = observe();
    opened.incident!.reasons.push("degrading_trend");
    opened.incident!.violations.push("externo");
    const read = state();
    expect(read.active?.reasons).toEqual(["policy_violation"]);
    expect(read.active?.violations).not.toContain("externo");
    read.active!.reasons.push("degrading_trend");
    expect(state().active?.reasons).toEqual(["policy_violation"]);
  });

  it("não modifica amostras, baseline ou métricas shadow ao reconhecer ocorrência", async () => {
    await createFailure();
    sample();
    const history = readCanonicalShadowDiagnosticHistory({ isTestMode: true });
    observe();
    acknowledgeCanonicalShadowDiagnosticIncident({ isTestMode: true, incidentId: 1 });
    expect(readCanonicalShadowDiagnosticHistory({ isTestMode: true })).toEqual(history);
    expect(sample().evaluation.baselineEstablished).toBe(false);
  });
});
