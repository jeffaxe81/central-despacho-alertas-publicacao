import { beforeEach, describe, expect, it } from "vitest";
import {
  getCanonicalShadowDiagnosticSnapshot,
  publishCanonicalShadowEvent,
  resetCanonicalShadowSubscribersForTest,
  subscribeCanonicalShadow,
} from "./canonicalShadow";

describe("canal shadow canônico interno", () => {
  beforeEach(() => {
    resetCanonicalShadowSubscribersForTest();
  });

  it("transporta o mesmo evento canônico para assinantes internos sem reconstrução", async () => {
    const received: Array<{ canonicalEvent: unknown; equivalent: boolean }> = [];
    const canonicalEvent = {
      specversion: "1.0",
      id: "evt_shadow_007",
      type: "com.axesistemas.alerta.urbano.recebido.v1",
      axessimulated: true,
    };

    const unsubscribe = subscribeCanonicalShadow(message => {
      received.push(message);
    });

    const result = await publishCanonicalShadowEvent({ canonicalEvent, equivalent: true });

    expect(result).toEqual({ delivered: 1, failed: 0 });
    expect(received).toHaveLength(1);
    expect(received[0]?.canonicalEvent).toBe(canonicalEvent);
    expect(received[0]?.equivalent).toBe(true);

    unsubscribe();
  });

  it("isola falha de um assinante sem impedir os demais", async () => {
    const received: unknown[] = [];
    const canonicalEvent = { id: "evt_shadow_failure" };

    subscribeCanonicalShadow(() => {
      throw new Error("falha do observador shadow");
    });
    subscribeCanonicalShadow(message => {
      received.push(message.canonicalEvent);
    });

    await expect(
      publishCanonicalShadowEvent({ canonicalEvent, equivalent: false })
    ).resolves.toEqual({ delivered: 1, failed: 1 });

    expect(received).toEqual([canonicalEvent]);
  });

  it("consolida publicações, entregas, falhas e equivalências em snapshot diagnóstico", async () => {
    subscribeCanonicalShadow(() => undefined);
    subscribeCanonicalShadow(message => {
      if (!message.equivalent) throw new Error("falha shadow esperada");
    });

    await publishCanonicalShadowEvent({
      canonicalEvent: { id: "evt_equivalent" },
      equivalent: true,
    });
    await publishCanonicalShadowEvent({
      canonicalEvent: { id: "evt_divergent" },
      equivalent: false,
    });

    expect(getCanonicalShadowDiagnosticSnapshot()).toEqual({
      publications: 2,
      delivered: 3,
      failed: 1,
      equivalent: 1,
      divergent: 1,
    });
  });

  it("zera o snapshot diagnóstico junto com o reset do canal de teste", async () => {
    await publishCanonicalShadowEvent({
      canonicalEvent: { id: "evt_before_reset" },
      equivalent: true,
    });

    expect(getCanonicalShadowDiagnosticSnapshot().publications).toBe(1);

    resetCanonicalShadowSubscribersForTest();

    expect(getCanonicalShadowDiagnosticSnapshot()).toEqual({
      publications: 0,
      delivered: 0,
      failed: 0,
      equivalent: 0,
      divergent: 0,
    });
  });
});
