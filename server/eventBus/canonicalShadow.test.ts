import { beforeEach, describe, expect, it } from "vitest";
import {
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
});
