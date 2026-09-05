import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "../db";
import { postWithRetry } from "../alertEngine";
import { broadcastToSse } from "./sseBroadcaster";
import { publishEvent } from "./publish";

vi.mock("../db", () => ({
  recordOutboxEvent: vi.fn(),
  listActiveSubscriptionsForEvent: vi.fn(),
  updateOutboxDelivery: vi.fn(),
}));

vi.mock("../alertEngine", () => ({
  postWithRetry: vi.fn(),
}));

vi.mock("./sseBroadcaster", () => ({
  broadcastToSse: vi.fn(),
}));

const mockDb = vi.mocked(db);
const mockPostWithRetry = vi.mocked(postWithRetry);
const mockBroadcast = vi.mocked(broadcastToSse);

const baseEvent = {
  userId: 7,
  tenantId: "default",
  correlationId: "corr-1",
  eventId: "evt-1",
  category: "semaforos",
  connectorId: "axe-dispatch",
  payload: { hello: "mundo" },
};

describe("publishEvent", () => {
  afterEach(() => vi.resetAllMocks());

  it("grava no outbox e marca 'no_subscribers' quando não há assinatura ativa", async () => {
    mockDb.recordOutboxEvent.mockResolvedValue(42);
    mockDb.listActiveSubscriptionsForEvent.mockResolvedValue([]);

    await publishEvent(baseEvent);

    expect(mockDb.recordOutboxEvent).toHaveBeenCalledWith(expect.objectContaining({ correlationId: "corr-1", eventId: "evt-1" }));
    expect(mockDb.updateOutboxDelivery).toHaveBeenCalledWith(42, { status: "no_subscribers", deliveredCount: 0, failedCount: 0 });
    expect(mockPostWithRetry).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it("entrega via webhook a assinaturas do tipo 'webhook' e marca 'delivered' em sucesso", async () => {
    mockDb.recordOutboxEvent.mockResolvedValue(1);
    mockDb.listActiveSubscriptionsForEvent.mockResolvedValue([
      { id: 5, deliveryMode: "webhook", endpointUrl: "https://consumidor.example/hook", headersJson: "{}", outboundApiKey: "chave", outboundApiKeyHeader: "X-ALRT-API-Key" } as any,
    ]);
    mockPostWithRetry.mockResolvedValue({ ok: true, status: 200, summary: "ok", attempts: 1 });

    await publishEvent(baseEvent);

    expect(mockPostWithRetry).toHaveBeenCalledWith(expect.objectContaining({ endpointUrl: "https://consumidor.example/hook", apiKey: "chave" }));
    expect(mockDb.updateOutboxDelivery).toHaveBeenCalledWith(1, { status: "delivered", deliveredCount: 1, failedCount: 0 });
  });

  it("faz broadcast SSE para assinaturas do tipo 'sse' e marca 'failed' quando ninguém está conectado", async () => {
    mockDb.recordOutboxEvent.mockResolvedValue(2);
    mockDb.listActiveSubscriptionsForEvent.mockResolvedValue([
      { id: 9, deliveryMode: "sse", subscriberApiKey: "sub-key-9" } as any,
    ]);
    mockBroadcast.mockReturnValue(0);

    await publishEvent(baseEvent);

    expect(mockBroadcast).toHaveBeenCalledWith("sub-key-9", baseEvent.payload);
    expect(mockDb.updateOutboxDelivery).toHaveBeenCalledWith(2, { status: "failed", deliveredCount: 0, failedCount: 0 });
  });

  it("nunca lança: falha ao gravar no outbox é tratada e a função retorna normalmente", async () => {
    mockDb.recordOutboxEvent.mockRejectedValue(new Error("banco fora do ar"));

    await expect(publishEvent(baseEvent)).resolves.toBeUndefined();
    expect(mockDb.listActiveSubscriptionsForEvent).not.toHaveBeenCalled();
  });
});
