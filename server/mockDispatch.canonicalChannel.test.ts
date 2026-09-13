import { beforeEach, describe, expect, it, vi } from "vitest";

const recordMockReceipt = vi.hoisted(() => vi.fn());
const logEvent = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({ recordMockReceipt }));
vi.mock("./observability/logger", () => ({ logEvent }));

import {
  resetCanonicalShadowSubscribersForTest,
  subscribeCanonicalShadow,
} from "./eventBus/canonicalShadow";
import { deliverToInternalMock } from "./mockDispatch";

beforeEach(() => {
  vi.clearAllMocks();
  resetCanonicalShadowSubscribersForTest();
  recordMockReceipt.mockResolvedValue(undefined);
});

describe("MUE-007 integração mock → canal shadow", () => {
  it("transporta o mesmo canonicalEvent explícito com o resultado de equivalência", async () => {
    const payload = {
      schemaVersion: "1.0",
      eventId: "evt_SIM-MUE007",
      eventType: "alert.received",
      occurredAt: "2026-09-12T22:00:00.000Z",
      source: { system: "despacho-alrt", environment: "homologacao" },
      correlationId: "corr_12345678-1234-1234-1234-123456789abc",
      idempotencyKey: "alrt:alert:SIM-MUE007:created:v1",
      data: {
        alert: {
          externalId: "SIM-MUE007",
          category: "Falha semafórica",
          priority: "alta",
          description: "Canal shadow interno.",
          address: "Avenida Central, nº 700",
          latitude: -23.55052,
          longitude: -46.633308,
          reportedAt: "2026-09-12T22:00:00.000Z",
          sourceStatus: "novo",
        },
      },
    };
    const canonicalEvent = {
      specversion: "1.0",
      id: payload.eventId,
      source: "urn:axesistemas:motor-eventos",
      type: "com.axesistemas.alerta.urbano.recebido.v1",
      subject: "alerta/SIM-MUE007",
      time: payload.occurredAt,
      datacontenttype: "application/json",
      dataschema: "urn:axesistemas:schema:alerta:urbano:1.0.0",
      correlationid: payload.correlationId,
      idempotencykey: payload.idempotencyKey,
      axesrunid: "run-mue-007",
      axesscenarioid: "cenario-mue-007",
      axesscenarioversion: "1.0.0",
      axesseed: "mue-007",
      axessequence: 1,
      axessimulated: true,
      data: {
        assetId: "SIM-MUE007",
        category: "Falha semafórica",
        severity: "alta",
        description: "Canal shadow interno.",
        location: {
          address: "Avenida Central, nº 700",
          latitude: -23.55052,
          longitude: -46.633308,
        },
      },
    };
    const received: Array<{ canonicalEvent: unknown; equivalent: boolean }> = [];
    const unsubscribe = subscribeCanonicalShadow(message => received.push(message));

    await deliverToInternalMock({
      userId: 12,
      dispatchedAlertId: 70,
      payloadJson: JSON.stringify(payload),
      canonicalEvent,
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.canonicalEvent).toBe(canonicalEvent);
    expect(received[0]?.equivalent).toBe(true);

    unsubscribe();
  });

  it("mantém a resposta 202 quando um assinante shadow falha", async () => {
    subscribeCanonicalShadow(() => {
      throw new Error("falha isolada do assinante shadow");
    });

    await expect(
      deliverToInternalMock({
        userId: 12,
        dispatchedAlertId: 71,
        payloadJson: '{"schemaVersion":"1.0"}',
        canonicalEvent: { invalid: true },
      })
    ).resolves.toMatchObject({
      ok: true,
      status: 202,
      compatibility: { checked: true, equivalent: false },
    });
  });
});
