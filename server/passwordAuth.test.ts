import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwordAuth";

describe("passwordAuth", () => {
  it("gera hash scrypt sem armazenar a senha em texto puro", async () => {
    const hash = await hashPassword("UmaSenhaForte!2026");
    expect(hash).toMatch(/^scrypt\$[^$]+\$[^$]+$/);
    expect(hash).not.toContain("UmaSenhaForte!2026");
  });

  it("valida a senha correta e rejeita senha incorreta", async () => {
    const hash = await hashPassword("UmaSenhaForte!2026");
    await expect(verifyPassword("UmaSenhaForte!2026", hash)).resolves.toBe(true);
    await expect(verifyPassword("SenhaIncorreta!2026", hash)).resolves.toBe(false);
  });
});
