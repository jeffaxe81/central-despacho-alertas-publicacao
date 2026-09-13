import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertType } from "../drizzle/schema";
import { ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE } from "../shared/alertSimulation";
import { dispatchConfiguredAlert } from "./alertEngine";
import * as db from "./db";
import {
  resetCanonicalShadowSubscribersForTest,
  subscribeCanonicalShadow,
} from "./eventBus/canonicalShadow";

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

function structuredLogEntries(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls
    .map(call => call[0])
    .filter((value): value is string => typeof value === "string")
    .flatMap(value => {
      try {
        return [JSON.parse(value) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCanonicalShadowSubscribersForTest();
  mockDb.createDispatchedAlert.mockResolvedValue(301);
  mockDb.updateDispatchedAlert.mockResolvedValue(undefined);
  mockDb.recordMockReceipt.mockResolvedValue(undefined);
  mockDb.recordOutboxEvent.mockResolvedValue(0);
  mockDb.listActiveSubscriptionsForEvent.mockResolvedValue([]);
  mockDb.updateOutboxDelivery.mockResolvedValue(undefined);
});

describe("MUE-008 publicação shadow no dispatcher", () => {
  it("publica o canônico explícito usando a equivalência validada pelo mock", async () => {
    const received: Array<{ canonicalEvent: unknown; equivalent: boolean }> = [];
    const unsubscribe = subscribeCanonicalShadow(message => received.push(message));

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
    expect(received).toHaveLength(1);
    expect(received[0]?.equivalent).toBe(true);
    expect(received[0]?.canonicalEvent).toMatchObject({
      specversion: "1.0",
      type: "com.axesistemas.alerta.urbano.recebido.v1",
      axessimulated: true,
      correlationid: result.occurrence.correlationId,
    });

    unsubscribe();
  });

  it("mantém o despacho 202 quando um assinante shadow falha", async () => {
    subscribeCanonicalShadow(() => {
      throw new Error("falha isolada do assinante shadow");
    });

    await expect(dispatchConfiguredAlert(axeTestAlertType)).resolves.toMatchObject({
      ok: true,
      status: 202,
      compatibility: { checked: true, equivalent: true },
    });
  });
});

describe("MUE-009 observabilidade da publicação shadow", () => {
  it("registra delivered e failed após publicação shadow bem-sucedida", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const unsubscribe = subscribeCanonicalShadow(() => undefined);

    const result = await dispatchConfiguredAlert(axeTestAlertType);
    const publicationLog = structuredLogEntries(consoleLog).find(
      entry => entry.event === "eventbus.canonical_shadow_published"
    );

    expect(result).toMatchObject({ ok: true, status: 202 });
    expect(publicationLog).toMatchObject({
      level: "info",
      event: "eventbus.canonical_shadow_published",
      correlationId: result.occurrence.correlationId,
      type: "com.axesistemas.alerta.urbano.recebido.v1",
      simulated: true,
      equivalent: true,
      delivered: 1,
      failed: 0,
    });
    expect(publicationLog?.eventId).toBe(`evt_${result.occurrence.eventId}`);

    unsubscribe();
    consoleLog.mockRestore();
  });

  it("registra warn e failed sem alterar o 202 quando assinante shadow falha", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    subscribeCanonicalShadow(() => {
      throw new Error("falha observável do assinante shadow");
    });

    const result = await dispatchConfiguredAlert(axeTestAlertType);
    const publicationLog = structuredLogEntries(consoleWarn).find(
      entry => entry.event === "eventbus.canonical_shadow_published"
    );

    expect(result).toMatchObject({
      ok: true,
      status: 202,
      compatibility: { checked: true, equivalent: true },
    });
    expect(publicationLog).toMatchObject({
      level: "warn",
      event: "eventbus.canonical_shadow_published",
      correlationId: result.occurrence.correlationId,
      type: "com.axesistemas.alerta.urbano.recebido.v1",
      simulated: true,
      equivalent: true,
      delivered: 0,
      failed: 1,
    });
    expect(publicationLog?.eventId).toBe(`evt_${result.occurrence.eventId}`);

    consoleWarn.mockRestore();
  });
});
