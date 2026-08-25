import { describe, expect, it, vi } from "vitest";
import { formatApiKey, generateIntegrationApiKey } from "./apiKey";

describe("formatApiKey", () => {
  it("cria uma API key hexadecimal com o prefixo operacional", () => {
    const key = formatApiKey(new Uint8Array(32).fill(171));
    expect(key).toBe(`ak_${"ab".repeat(32)}`);
    expect(key).toHaveLength(67);
  });

  it("rejeita fontes aleatórias com tamanho incorreto", () => {
    expect(() => formatApiKey(new Uint8Array(16))).toThrow(/32 bytes/i);
  });

  it("solicita 32 bytes aleatórios para gerar uma chave pronta para integração", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(205);
      return bytes;
    });

    const key = generateIntegrationApiKey({ getRandomValues });

    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(getRandomValues.mock.calls[0]?.[0]).toHaveLength(32);
    expect(key).toBe(`ak_${"cd".repeat(32)}`);
  });
});
