import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertType } from "../drizzle/schema";
import { ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE } from "../shared/alertSimulation";
import { dispatchConfiguredAlert } from "./alertEngine";
import * as db from "./db";

vi.mock("./db", () => ({
  createDispatchedAlert: vi.fn(),
  updateDispatchedAlert: vi.fn(),
  recordMockReceipt: vi.fn(),
  recordOutboxEvent: vi.fn().mockResolvedValue(1),
  listActiveSubscriptionsForEvent: vi.fn().mockResolvedValue([]),
  updateOutboxDelivery: vi.fn().mockResolvedValue(undefined),
}));

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
  simulationSeed: "semente-shadow",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.createDispatchedAlert.mockResolvedValue(301);
  mockDb.updateDispatchedAlert.mockResolvedValue(undefined);
  mockDb.recordMockReceipt.mockResolvedValue(undefined);
  mockDb.recordOutboxEvent.mockResolvedValue(0);
  mockDb.listActiveSubscriptionsForEvent.mockResolvedValue([]);
  mockDb.updateOutboxDelivery.mockResolvedValue(undefined);
});

describe("MUE-003 shadow canônico no dispatcher", () => {
  it("compara a projeção canônica com o legado quando ALRT → AXE está em modo teste", async () => {
    const result = await dispatchConfiguredAlert(axeTestAlertType);

    expect(result).toMatchObject({
      ok: true,
      status: 202,
      compatibility: { checked: true, equivalent: true },
    });
    expect(mockDb.recordMockReceipt).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      dispatchedAlertId: 301,
    }));
  });
});
