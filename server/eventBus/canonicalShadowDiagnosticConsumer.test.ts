import { beforeEach, describe, expect, it } from "vitest";
import {
  publishCanonicalShadowEvent,
  resetCanonicalShadowSubscribersForTest,
  subscribeCanonicalShadow,
} from "./canonicalShadow";
import { createCanonicalShadowDiagnosticReport } from "./canonicalShadowDiagnosticConsumer";

describe("MUE-012 consumidor diagnóstico interno shadow", () => {
  beforeEach(() => {
    resetCanonicalShadowSubscribersForTest();
  });

  it("retorna diagnóstico ocioso quando ainda não houve publicações", () => {
    expect(createCanonicalShadowDiagnosticReport({ isTestMode: true })).toEqual({
      status: "idle",
      publications: 0,
      delivered: 0,
      failed: 0,
      equivalent: 0,
      divergent: 0,
      deliverySuccessRate: null,
      equivalenceRate: null,
    });
  });

  it("classifica como healthy quando todas as entregas e equivalências são bem-sucedidas", async () => {
    subscribeCanonicalShadow(() => undefined);

    await publishCanonicalShadowEvent({ canonicalEvent: { id: "evt_healthy" }, equivalent: true });

    expect(createCanonicalShadowDiagnosticReport({ isTestMode: true })).toEqual({
      status: "healthy",
      publications: 1,
      delivered: 1,
      failed: 0,
      equivalent: 1,
      divergent: 0,
      deliverySuccessRate: 1,
      equivalenceRate: 1,
    });
  });

  it("consolida o snapshot em um resumo operacional quando há falha ou divergência", async () => {
    subscribeCanonicalShadow(() => undefined);
    subscribeCanonicalShadow(message => {
      if (!message.equivalent) throw new Error("falha shadow esperada");
    });

    await publishCanonicalShadowEvent({ canonicalEvent: { id: "evt_ok" }, equivalent: true });
    await publishCanonicalShadowEvent({ canonicalEvent: { id: "evt_attention" }, equivalent: false });

    expect(createCanonicalShadowDiagnosticReport({ isTestMode: true })).toEqual({
      status: "attention",
      publications: 2,
      delivered: 3,
      failed: 1,
      equivalent: 1,
      divergent: 1,
      deliverySuccessRate: 0.75,
      equivalenceRate: 0.5,
    });
  });

  it("mantém o bloqueio da fronteira fora do modo teste", () => {
    expect(() => createCanonicalShadowDiagnosticReport({ isTestMode: false }))
      .toThrow("Diagnóstico shadow disponível somente em modo teste.");
  });
});
