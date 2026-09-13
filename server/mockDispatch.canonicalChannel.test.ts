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

describe("MUE-008 mock como receptor/validador shadow", () => {
  it("calcula compatibilidade sem publicar diretamente no canal shadow", async () => {
    const payload = {
      schemaVersion: "1.0",
      eventId: "evt_SIM-MUE008",
      eventType: "alert.received",
      occurredAt: "2026-09-12T23:20:00.000Z",
      source: { system: "despacho-alrt", environment: "homologacao" },
      correlationId: "corr_12345678-1234-1234-1234-123456789abc",
      idempotencyKey: "alrt:alert:SIM-MUE008:created:v1",
      data: {
        alert: {
          externalId: "SIM-MUE008",
          category: "Falha semafórica",
          priority: "alta",
          description: "Canal shadow originado no dispatcher.",
          address: "Avenida Central, nº 800",
          latitude: -23.55052,
          longitude: -46.633308,
          reportedAt: "2026-09-12T23:20:00.000Z",
          sourceStatus: "novo",
        },
      },
    };
    const canonicalEvent = {
      specversion: "1.0",
      id: payload.eventId,
      source: "urn:axesistemas:motor-eventos",
      type: "com.axesistemas.alerta.urbano.recebido.v1",
      subject: "alerta/SIM-MUE008",
      time: payload.occurredAt,
      datacontenttype: "application/json",
      dataschema: "urn:axesistemas:schema:alerta:urbano:1.0.0",
      correlationid: payload.correlationId,
      idempotencykey: payload.idempotencyKey,
      axesrunid: "run-mue-008",
      axesscenarioid: "cenario-mue-008",
      axesscenarioversion: "1.0.0",
      axesseed: "mue-008",
      axessequence: 1,
      axessimulated: true,
      data: {
        assetId: "SIM-MUE008",
        category: "Falha semafórica",
        severity: "alta",
        description: "Canal shadow originado no dispatcher.",
        location: {
          address: "Avenida Central, nº 800",
          latitude: -23.55052,
          longitude: -46.633308,
        },
      },
    };
    const received: unknown[] = [];
    subscribeCanonicalShadow(message => received.push(message));

    await expect(
      deliverToInternalMock({
        userId: 12,
        dispatchedAlertId: 80,
        payloadJson: JSON.stringify(payload),
        canonicalEvent,
      })
    ).resolves.toMatchObject({
      ok: true,
      status: 202,
      compatibility: { checked: true, equivalent: true },
    });

    expect(received).toHaveLength(0);
  });

  it("continua não bloqueante para canônico inválido sem publicar no canal", async () => {
    const received: unknown[] = [];
    subscribeCanonicalShadow(message => received.push(message));

    await expect(
      deliverToInternalMock({
        userId: 12,
        dispatchedAlertId: 81,
        payloadJson: '{"schemaVersion":"1.0"}',
        canonicalEvent: { invalid: true },
      })
    ).resolves.toMatchObject({
      ok: true,
      status: 202,
      compatibility: { checked: true, equivalent: false },
    });

    expect(received).toHaveLength(0);
  });
});
