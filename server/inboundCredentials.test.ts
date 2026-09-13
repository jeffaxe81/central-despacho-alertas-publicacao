import { describe, expect, it } from "vitest";
import { createInboundCredential, hashInboundSecret, parseInboundCredential, verifyInboundSecret } from "./inboundCredentials";

describe("inboundCredentials", () => {
  it("gera credencial parseável e não expõe o segredo no publicId", () => {
    const generated = createInboundCredential();
    const parsed = parseInboundCredential(generated.presented);
    expect(parsed).toEqual({ publicId: generated.publicId, secret: generated.secret });
    expect(generated.publicId).not.toContain(generated.secret);
  });

  it("verifica o segredo correto e rejeita o incorreto", async () => {
    const generated = createInboundCredential();
    const hash = await hashInboundSecret(generated.secret);
    await expect(verifyInboundSecret(generated.secret, hash)).resolves.toBe(true);
    await expect(verifyInboundSecret(`${generated.secret}x`, hash)).resolves.toBe(false);
  });

  it("rejeita formatos curtos ou sem prefixo", () => {
    expect(parseInboundCredential(undefined)).toBeNull();
    expect(parseInboundCredential("legacy-key")).toBeNull();
    expect(parseInboundCredential("wrong_public.short")).toBeNull();
  });
});
