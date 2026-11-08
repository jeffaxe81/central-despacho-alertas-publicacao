import { logEvent } from "../observability/logger";

export const DEFAULT_OUTBOX_RETENTION_DAYS = 30;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/** EVENT_OUTBOX_RETENTION_DAYS: inteiro >= 0. 0 desativa a limpeza. */
export function readOutboxRetentionDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.EVENT_OUTBOX_RETENTION_DAYS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_OUTBOX_RETENTION_DAYS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_OUTBOX_RETENTION_DAYS;
}

/**
 * Executa a limpeza do outbox uma vez e agenda novas execuções a cada 6 horas.
 * O timer é `unref` para não impedir o encerramento do processo. A limpeza é
 * idempotente, então rodar em mais de uma instância não causa dano.
 */
export function startOutboxRetention(
  prune: (retentionDays: number) => Promise<number>,
  retentionDays: number = readOutboxRetentionDays(),
  intervalMs: number = SIX_HOURS_MS
): NodeJS.Timeout | null {
  if (retentionDays === 0) {
    logEvent("info", "eventbus.outbox_retention_disabled", {});
    return null;
  }

  const run = async () => {
    try {
      const removed = await prune(retentionDays);
      logEvent("info", "eventbus.outbox_pruned", { retentionDays, removed });
    } catch (error) {
      logEvent("error", "eventbus.outbox_prune_failed", {
        retentionDays,
        reason: error instanceof Error ? error.message : "Erro desconhecido.",
      });
    }
  };

  void run();
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return timer;
}
