import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertType } from "../drizzle/schema";
import { ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE } from "../shared/alertSimulation";
import { toAlrtAxeEvent } from "../shared/connectors/alrtAxeAdapter";

const deliverToInternalMock = vi.hoisted(() => vi.fn());
const publishEvent = vi.hoisted(() => vi.fn());

vi.mock("./mockDispatch", () => ({ deliverToInternalMock }));
vi.mock("./eventBus/publish", () => ({ publishEvent }));
vi.mock("./db", () => ({
  createDispatchedAlert: vi.fn(),
  updateDispatchedAlert: vi.fn(),
}));

import { dispatchConfiguredAlert } from "./alertEngine";
import * as db from "./db";

const mockDb = vi.mocked(db);

const axeTestAlertType: AlertType = {
  id: 10,
  userId: 7,
  category: "semaforos",
  name: "Falha semafórica",
  defaultDescription: "Falha simulada de semáforo.",
  defaultSeverity: "alta",
  endpointUrl: "mock://central-despacho",
  headersJson: "{}",
  authToken: null,
  payloadTemplate: ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE,
  isTestMode: true,
  autoEnabled: false,
  autoIntervalMinutes: 15,
  defaultLatitude: -23.55052,
  defaultLongitude: -46.633308,
  useGeneralLocation: true,
  scheduleCronTaskUid: null,
  simulationSeed: "semente-canonical-first",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.createDispatchedAlert.mockResolvedValue(401);
  mockDb.updateDispatchedAlert.mockResolvedValue(undefined);
  publishEvent.mockResolvedValue(undefined);
  deliverToInternalMock.mockResolvedValue({
    ok: true,
    status: 202,
    summary: "Recebido pelo endpoint mock interno.",
    attempts: 1,
    failureReason: undefined,
    compatibility: { checked: true, equivalent: true },
  });
});

describe("MUE-004 geração canônica antes do mock", () => {
  it("passa explicitamente o evento canônico em paralelo ao payload legado ALRT → AXE", async () => {
    await dispatchConfiguredAlert(axeTestAlertType);

    expect(deliverToInternalMock).toHaveBeenCalledTimes(1);
    const input = deliverToInternalMock.mock.calls[0]![0];
    const legacyPayload = JSON.parse(input.payloadJson);

    expect(input.canonicalEvent).toMatchObject({
      specversion: "1.0",
      id: legacyPayload.eventId,
      source: "urn:axesistemas:motor-eventos:alertas",
      type: "com.axesistemas.alerta.urbano.recebido.v1",
      subject: `alerta/${legacyPayload.data.alert.externalId}`,
      time: legacyPayload.occurredAt,
      datacontenttype: "application/json",
      dataschema: "urn:axesistemas:schema:alerta:urbano:1.0.0",
      correlationid: legacyPayload.correlationId,
      idempotencykey: legacyPayload.idempotencyKey,
      axessimulated: true,
      data: {
        assetId: legacyPayload.data.alert.externalId,
        category: legacyPayload.data.alert.category,
        severity: legacyPayload.data.alert.priority,
        description: legacyPayload.data.alert.description,
        location: {
          address: legacyPayload.data.alert.address,
          latitude: legacyPayload.data.alert.latitude,
          longitude: legacyPayload.data.alert.longitude,
        },
      },
    });

    expect(toAlrtAxeEvent(input.canonicalEvent)).toEqual(legacyPayload);
  });
});

describe("MUE-006 fronteira canônica observável no barramento", () => {
  it("passa o mesmo canonicalEvent explicitamente ao publishEvent sem substituir o payload legado", async () => {
    await dispatchConfiguredAlert(axeTestAlertType);

    const mockInput = deliverToInternalMock.mock.calls[0]![0];
    const legacyPayload = JSON.parse(mockInput.payloadJson);

    expect(publishEvent).toHaveBeenCalledTimes(1);
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: legacyPayload,
        canonicalEvent: mockInput.canonicalEvent,
      })
    );
  });
});
