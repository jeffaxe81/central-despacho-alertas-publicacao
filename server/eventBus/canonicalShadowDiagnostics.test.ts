import { beforeEach, describe, expect, it } from "vitest";
import {
  publishCanonicalShadowEvent,
  resetCanonicalShadowSubscribersForTest,
  subscribeCanonicalShadow,
} from "./canonicalShadow";
import { readCanonicalShadowDiagnosticSnapshot } from "./canonicalShadowDiagnostics";

describe("MUE-011 fronteira interna de diagnóstico shadow", () => {
  beforeEach(() => {
    resetCanonicalShadowSubscribersForTest();
  });

  it("permite consultar uma cópia do snapshot somente quando o modo teste está ativo", async () => {
    subscribeCanonicalShadow(() => undefined);

    await publishCanonicalShadowEvent({
      canonicalEvent: { id: "evt_mue_011" },
      equivalent: true,
    });

    const snapshot = readCanonicalShadowDiagnosticSnapshot({ isTestMode: true });
    const secondSnapshot = readCanonicalShadowDiagnosticSnapshot({ isTestMode: true });

    expect(snapshot).toEqual({
      publications: 1,
      delivered: 1,
      failed: 0,
      equivalent: 1,
      divergent: 0,
    });
    expect(snapshot).not.toBe(secondSnapshot);

    (snapshot as { publications: number }).publications = 999;

    expect(readCanonicalShadowDiagnosticSnapshot({ isTestMode: true }).publications).toBe(1);
  });

  it("rejeita a consulta quando o modo teste não está ativo", () => {
    expect(() => readCanonicalShadowDiagnosticSnapshot({ isTestMode: false }))
      .toThrow("Diagnóstico shadow disponível somente em modo teste.");
  });
});
