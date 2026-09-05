import { describe, expect, it, vi } from "vitest";
import { broadcastToSse, connectedClientCount, registerSseClient, resetSseBroadcasterForTests, unregisterSseClient } from "./sseBroadcaster";

function fakeResponse() {
  return { write: vi.fn() } as unknown as import("express").Response;
}

describe("sseBroadcaster", () => {
  it("entrega o evento a todos os clientes conectados da mesma chave de assinante", () => {
    resetSseBroadcasterForTests();
    const clientA = fakeResponse();
    const clientB = fakeResponse();
    registerSseClient("key-1", clientA);
    registerSseClient("key-1", clientB);

    const reached = broadcastToSse("key-1", { eventId: "evt-1" });

    expect(reached).toBe(2);
    expect(clientA.write).toHaveBeenCalledWith('data: {"eventId":"evt-1"}\n\n');
    expect(clientB.write).toHaveBeenCalledWith('data: {"eventId":"evt-1"}\n\n');
  });

  it("não entrega a clientes de outra chave de assinante nem a clientes desregistrados", () => {
    resetSseBroadcasterForTests();
    const client = fakeResponse();
    registerSseClient("key-2", client);
    unregisterSseClient("key-2", client);

    expect(connectedClientCount("key-2")).toBe(0);
    expect(broadcastToSse("key-2", { eventId: "evt-2" })).toBe(0);
    expect(broadcastToSse("outra-chave", { eventId: "evt-3" })).toBe(0);
  });
});
