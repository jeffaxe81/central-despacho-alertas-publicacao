import { describe, expect, it, vi } from "vitest";

const recordMockReceipt = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({ recordMockReceipt }));

import { deliverToInternalMock } from "./mockDispatch";

describe("endpoint mock interno", () => {
  it("persiste o recebimento e retorna aceitação para a simulação", async () => {
    recordMockReceipt.mockResolvedValue(undefined);

    await expect(
      deliverToInternalMock({ userId: 12, dispatchedAlertId: 45, payloadJson: '{"categoria":"cameras"}' })
    ).resolves.toMatchObject({ ok: true, status: 202, attempts: 1 });

    expect(recordMockReceipt).toHaveBeenCalledWith({
      userId: 12,
      dispatchedAlertId: 45,
      payloadJson: '{"categoria":"cameras"}',
    });
  });

  it("compara o evento canônico explícito com o payload legado no modo shadow", async () => {
    recordMockReceipt.mockResolvedValue(undefined);
    const payload = {
      schemaVersion: "1.0",
      eventId: "evt_SIM-20260912-AXE001",
      eventType: "alert.received",
      occurredAt: "2026-09-12T21:30:00.000Z",
      source: { system: "despacho-alrt", environment: "homologacao" },
      correlationId: "corr_12345678-1234-1234-1234-123456789abc",
      idempotencyKey: "alrt:alert:SIM-20260912-AXE001:created:v1",
      data: {
        alert: {
          externalId: "SIM-20260912-AXE001",
          category: "Falha semafórica",
          priority: "alta",
          description: "Semáforo sem comunicação.",
          address: "Avenida Central, nº 100",
          latitude: -23.55052,
          longitude: -46.633308,
          reportedAt: "2026-09-12T21:30:00.000Z",
          sourceStatus: "novo",
        },
      },
    };
    const canonicalEvent = {
      specversion: "1.0",
      id: payload.eventId,
      source: "urn:axesistemas:motor-eventos",
      type: "com.axesistemas.alerta.urbano.recebido.v1",
      subject: "alerta/SIM-20260912-AXE001",
      time: payload.occurredAt,
      datacontenttype: "application/json",
      dataschema: "urn:axesistemas:schema:alerta:urbano:1.0.0",
      correlationid: payload.correlationId,
      idempotencykey: payload.idempotencyKey,
      axesrunid: "run-shadow-001",
      axesscenarioid: "cenario-shadow-axe",
      axesscenarioversion: "1.0.0",
      axesseed: "shadow-axe-001",
      axessequence: 1,
      axessimulated: true,
      data: {
        assetId: "SIM-20260912-AXE001",
        category: "Falha semafórica",
        severity: "alta",
        description: "Semáforo sem comunicação.",
        location: {
          address: "Avenida Central, nº 100",
          latitude: -23.55052,
          longitude: -46.633308,
        },
      },
    };

    await expect(
      deliverToInternalMock({
        userId: 12,
        dispatchedAlertId: 46,
        payloadJson: JSON.stringify(payload),
        canonicalEvent,
      })
    ).resolves.toMatchObject({
      ok: true,
      status: 202,
      compatibility: { checked: true, equivalent: true },
    });
  });

  it("não reconstrói canônico a partir do payload legado quando canonicalEvent não é informado", async () => {
    recordMockReceipt.mockResolvedValue(undefined);
    const payload = {
      schemaVersion: "1.0",
      eventId: "evt_SIM-20260912-AXE002",
      eventType: "alert.received",
      occurredAt: "2026-09-12T21:31:00.000Z",
      source: { system: "despacho-alrt", environment: "homologacao" },
      correlationId: "corr_22345678-1234-1234-1234-123456789abc",
      idempotencyKey: "alrt:alert:SIM-20260912-AXE002:created:v1",
      data: {
        alert: {
          externalId: "SIM-20260912-AXE002",
          category: "Falha semafórica",
          priority: "alta",
          description: "Payload legado sem canônico explícito.",
          address: "Avenida Central, nº 101",
          latitude: -23.55052,
          longitude: -46.633308,
          reportedAt: "2026-09-12T21:31:00.000Z",
          sourceStatus: "novo",
        },
      },
    };

    const result = await deliverToInternalMock({
      userId: 12,
      dispatchedAlertId: 47,
      payloadJson: JSON.stringify(payload),
    });

    expect(result).toMatchObject({ ok: true, status: 202 });
    expect(result).not.toHaveProperty("compatibility");
  });

  it("não bloqueia o mock quando o canonicalEvent explícito é inválido", async () => {
    recordMockReceipt.mockResolvedValue(undefined);
    const payload = {
      schemaVersion: "1.0",
      eventId: "evt_SIM-20260912-AXE003",
      eventType: "alert.received",
      occurredAt: "2026-09-12T21:32:00.000Z",
      source: { system: "despacho-alrt", environment: "homologacao" },
      correlationId: "corr_32345678-1234-1234-1234-123456789abc",
      idempotencyKey: "alrt:alert:SIM-20260912-AXE003:created:v1",
      data: {
        alert: {
          externalId: "SIM-20260912-AXE003",
          category: "Falha semafórica",
          priority: "alta",
          description: "Canônico explícito inválido para teste não bloqueante.",
          address: "Avenida Central, nº 102",
          latitude: -23.55052,
          longitude: -46.633308,
          reportedAt: "2026-09-12T21:32:00.000Z",
          sourceStatus: "novo",
        },
      },
    };

    await expect(
      deliverToInternalMock({
        userId: 12,
        dispatchedAlertId: 48,
        payloadJson: JSON.stringify(payload),
        canonicalEvent: { invalid: true },
      })
    ).resolves.toMatchObject({
      ok: true,
      status: 202,
      compatibility: { checked: true, equivalent: false },
    });
  });
});
