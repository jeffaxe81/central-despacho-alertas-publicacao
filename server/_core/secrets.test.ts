import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  resetSecretsKeyCacheForTests,
  secretDigest,
} from "./secrets";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.SECRETS_ENCRYPTION_KEY = "chave-de-teste-com-mais-de-32-caracteres-ok";
  resetSecretsKeyCacheForTests();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetSecretsKeyCacheForTests();
});

describe("cifragem de segredos em repouso", () => {
  it("cifra e decifra o mesmo valor, sem expor o texto em claro", () => {
    const encrypted = encryptSecret("api-key-super-secreta");
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted).not.toContain("api-key-super-secreta");
    expect(decryptSecret(encrypted)).toBe("api-key-super-secreta");
  });

  it("usa IV aleatório: dois cifrados do mesmo valor são diferentes", () => {
    expect(encryptSecret("mesmo")).not.toBe(encryptSecret("mesmo"));
  });

  it("devolve valores legados (sem prefixo) sem alteração", () => {
    expect(decryptSecret("legado-em-claro")).toBe("legado-em-claro");
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
  });

  it("detecta adulteração do valor cifrado", () => {
    const encrypted = encryptSecret("segredo");
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith("AA") ? "BB" : "AA");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("não decifra com outra chave-mestra", () => {
    const encrypted = encryptSecret("segredo");
    process.env.SECRETS_ENCRYPTION_KEY = "outra-chave-com-mais-de-32-caracteres-tambem";
    resetSecretsKeyCacheForTests();
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("recusa chave-mestra curta", () => {
    process.env.SECRETS_ENCRYPTION_KEY = "curta";
    resetSecretsKeyCacheForTests();
    expect(() => encryptSecret("x")).toThrow(/32 caracteres/);
  });

  it("exige a chave-mestra em produção", () => {
    delete process.env.SECRETS_ENCRYPTION_KEY;
    process.env.NODE_ENV = "production";
    resetSecretsKeyCacheForTests();
    expect(() => encryptSecret("x")).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });
});

describe("digest de busca", () => {
  it("é estável para o mesmo valor e diferente para valores distintos", () => {
    expect(secretDigest("chave-a")).toBe(secretDigest("chave-a"));
    expect(secretDigest("chave-a")).not.toBe(secretDigest("chave-b"));
  });

  it("não é o próprio segredo e tem 64 caracteres hexadecimais", () => {
    const digest = secretDigest("chave-a");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain("chave-a");
  });

  it("ignora espaços nas extremidades", () => {
    expect(secretDigest("  chave-a  ")).toBe(secretDigest("chave-a"));
  });
});
