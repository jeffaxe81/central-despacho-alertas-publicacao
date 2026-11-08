import { describe, expect, it, vi } from "vitest";
import { DEFAULT_OUTBOX_RETENTION_DAYS, readOutboxRetentionDays, startOutboxRetention } from "./retention";

describe("retenção do outbox", () => {
  it("usa o padrão quando a variável não está definida ou é inválida", () => {
    expect(readOutboxRetentionDays({} as NodeJS.ProcessEnv)).toBe(DEFAULT_OUTBOX_RETENTION_DAYS);
    expect(readOutboxRetentionDays({ EVENT_OUTBOX_RETENTION_DAYS: "abc" } as any)).toBe(DEFAULT_OUTBOX_RETENTION_DAYS);
    expect(readOutboxRetentionDays({ EVENT_OUTBOX_RETENTION_DAYS: "-3" } as any)).toBe(DEFAULT_OUTBOX_RETENTION_DAYS);
  });

  it("aceita 0 como desativação e valores positivos", () => {
    expect(readOutboxRetentionDays({ EVENT_OUTBOX_RETENTION_DAYS: "0" } as any)).toBe(0);
    expect(readOutboxRetentionDays({ EVENT_OUTBOX_RETENTION_DAYS: "90" } as any)).toBe(90);
  });

  it("não agenda nenhuma limpeza quando desativada", () => {
    const prune = vi.fn();
    expect(startOutboxRetention(prune, 0)).toBeNull();
    expect(prune).not.toHaveBeenCalled();
  });

  it("executa a limpeza com a janela configurada e agenda repetições", async () => {
    vi.useFakeTimers();
    try {
      const prune = vi.fn().mockResolvedValue(5);
      const timer = startOutboxRetention(prune, 7, 1000);
      expect(timer).not.toBeNull();
      await vi.advanceTimersByTimeAsync(0);
      expect(prune).toHaveBeenCalledWith(7);
      await vi.advanceTimersByTimeAsync(1000);
      expect(prune).toHaveBeenCalledTimes(2);
      clearInterval(timer!);
    } finally {
      vi.useRealTimers();
    }
  });

  it("não derruba o processo quando a limpeza falha", async () => {
    vi.useFakeTimers();
    try {
      const prune = vi.fn().mockRejectedValue(new Error("banco fora"));
      const timer = startOutboxRetention(prune, 7, 1000);
      await vi.advanceTimersByTimeAsync(0);
      expect(prune).toHaveBeenCalled();
      clearInterval(timer!);
    } finally {
      vi.useRealTimers();
    }
  });
});
