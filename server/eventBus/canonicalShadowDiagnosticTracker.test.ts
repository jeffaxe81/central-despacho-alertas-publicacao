import { beforeEach, describe, expect, it } from "vitest";
import {
  publishCanonicalShadowEvent,
  resetCanonicalShadowSubscribersForTest,
  subscribeCanonicalShadow,
} from "./canonicalShadow";
import {
  resetCanonicalShadowDiagnosticTrackerForTest,
  trackCanonicalShadowDiagnostic,
} from "./canonicalShadowDiagnosticTracker";

const thresholds = {
  minDeliverySuccessRate: 0.9,
  minEquivalenceRate: 0.95,
  maxFailed: 0,
  maxDivergent: 0,
};

async function publishHealthyEvent(id: string) {
  subscribeCanonicalShadow(() => undefined);
  await publishCanonicalShadowEvent({
    canonicalEvent: { id },
    equivalent: true,
  });
}

async function publishDegradingEvent(id: string) {
  subscribeCanonicalShadow(() => undefined);
  subscribeCanonicalShadow(message => {
    if (!message.equivalent) throw new Error("falha shadow esperada");
  });
  await publishCanonicalShadowEvent({
    canonicalEvent: { id },
    equivalent: false,
  });
}

describe("MUE-015 rastreador diagnóstico interno shadow", () => {
  beforeEach(() => {
    resetCanonicalShadowSubscribersForTest();
    resetCanonicalShadowDiagnosticTrackerForTest();
  });

  it("estabelece a primeira leitura como baseline sem tendência", async () => {
    await publishHealthyEvent("evt_baseline");

    const result = trackCanonicalShadowDiagnostic({
      isTestMode: true,
      thresholds,
    });

    expect(result.baselineEstablished).toBe(true);
    expect(result.previous).toBeNull();
    expect(result.current.status).toBe("healthy");
    expect(result.trend).toBeNull();
  });

  it("classifica automaticamente como degrading quando a leitura seguinte piora", async () => {
    await publishHealthyEvent("evt_healthy");
    trackCanonicalShadowDiagnostic({ isTestMode: true, thresholds });

    await publishDegradingEvent("evt_degrading");

    const result = trackCanonicalShadowDiagnostic({
      isTestMode: true,
      thresholds,
    });

    expect(result.baselineEstablished).toBe(false);
    expect(result.previous?.status).toBe("healthy");
    expect(result.current.status).toBe("warning");
    expect(result.trend?.trend).toBe("degrading");
  });

  it("classifica automaticamente como improving após uma leitura anterior pior", async () => {
    await publishDegradingEvent("evt_warning");
    trackCanonicalShadowDiagnostic({ isTestMode: true, thresholds });

    resetCanonicalShadowSubscribersForTest();
    await publishHealthyEvent("evt_recovered");

    const result = trackCanonicalShadowDiagnostic({
      isTestMode: true,
      thresholds,
    });

    expect(result.previous?.status).toBe("warning");
    expect(result.current.status).toBe("healthy");
    expect(result.trend?.trend).toBe("improving");
  });

  it("o reset remove apenas a baseline do rastreador", async () => {
    await publishHealthyEvent("evt_reset");
    trackCanonicalShadowDiagnostic({ isTestMode: true, thresholds });

    resetCanonicalShadowDiagnosticTrackerForTest();

    const result = trackCanonicalShadowDiagnostic({
      isTestMode: true,
      thresholds,
    });

    expect(result.baselineEstablished).toBe(true);
    expect(result.previous).toBeNull();
    expect(result.current.report.publications).toBe(1);
    expect(result.trend).toBeNull();
  });

  it("mantém o bloqueio fora do modo teste", () => {
    expect(() => trackCanonicalShadowDiagnostic({
      isTestMode: false,
      thresholds,
    })).toThrow("Diagnóstico shadow disponível somente em modo teste.");
  });
});
