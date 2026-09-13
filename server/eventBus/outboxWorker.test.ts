import { describe, expect, it, vi } from "vitest";
import { processDelivery, retryDelayMs, runOutboxWorker, type OutboxDelivery, type OutboxWorkerStore } from "./outboxWorker";

const delivery: OutboxDelivery = {
  id: 10,
  attempts: 0,
  maxAttempts: 3,
  payload: { eventId: "evt-10" },
  subscription: { id: 20, deliveryMode: "webhook", endpointUrl: "https://example.test/hook" },
};

function storeMock(): OutboxWorkerStore {
  return {
    claimDueDeliveries: vi.fn().mockResolvedValue([]),
    markDelivered: vi.fn().mockResolvedValue(undefined),
    scheduleRetry: vi.fn().mockResolvedValue(undefined),
    markDeadLetter: vi.fn().mockResolvedValue(undefined),
  };
}

describe("outboxWorker", () => {
  it("calcula backoff limitado com jitter", () => {
    expect(retryDelayMs(1, () => 0)).toBe(60_000);
    expect(retryDelayMs(99, () => 0)).toBe(15 * 60_000);
  });

  it("marca entrega bem-sucedida sem retry", async () => {
    const store = storeMock();
    const result = await processDelivery(store, delivery, async () => ({ ok: true, status: 202 }));

    expect(result).toBe("delivered");
    expect(store.markDelivered).toHaveBeenCalledWith(10, 202);
    expect(store.scheduleRetry).not.toHaveBeenCalled();
  });

  it("agenda retry para timeout e erro 5xx", async () => {
    const store = storeMock();
    const result = await processDelivery(store, delivery, async () => ({ ok: false, status: 503, failureReason: "indisponível" }), () => new Date("2026-01-01T00:00:00Z"));

    expect(result).toBe("retry");
    expect(store.scheduleRetry).toHaveBeenCalledWith(expect.objectContaining({ deliveryId: 10, attempts: 1, status: 503 }));
  });

  it("envia erro permanente para dead letter", async () => {
    const store = storeMock();
    const result = await processDelivery(store, delivery, async () => ({ ok: false, status: 400, failureReason: "payload inválido" }));

    expect(result).toBe("dead_letter");
    expect(store.markDeadLetter).toHaveBeenCalledWith(expect.objectContaining({ deliveryId: 10, status: 400 }));
  });

  it("interrompe após abort e não mantém polling", async () => {
    const store = storeMock();
    const controller = new AbortController();
    let sleeps = 0;
    controller.abort();

    await runOutboxWorker({
      store,
      transport: async () => ({ ok: true, status: 200 }),
      workerId: "test-worker",
      signal: controller.signal,
      sleep: async () => { sleeps += 1; },
    });

    expect(store.claimDueDeliveries).not.toHaveBeenCalled();
    expect(sleeps).toBe(0);
  });
});
