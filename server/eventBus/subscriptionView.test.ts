import { describe, expect, it } from "vitest";
import { toSafeSubscription } from "../db";

describe("visão pública de assinaturas", () => {
  it("nunca devolve chave de assinante nem segredo de saída", () => {
    const safe = toSafeSubscription({
      id: 3,
      label: "CRM",
      outboundApiKey: "v1:cifrado.tag.dados",
      subscriberApiKey: null,
      subscriberKeyDigest: "abc123",
    } as any);
    expect(safe).not.toHaveProperty("outboundApiKey");
    expect(safe).not.toHaveProperty("subscriberApiKey");
    expect(safe).not.toHaveProperty("subscriberKeyDigest");
    expect(safe).toMatchObject({ id: 3, label: "CRM", hasOutboundApiKey: true });
    expect(JSON.stringify(safe)).not.toContain("cifrado");
  });

  it("indica ausência de chave de saída quando não há segredo", () => {
    const safe = toSafeSubscription({ id: 4, outboundApiKey: null, subscriberApiKey: null, subscriberKeyDigest: "x" } as any);
    expect(safe.hasOutboundApiKey).toBe(false);
  });
});
