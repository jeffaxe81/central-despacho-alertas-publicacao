import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE, AXE_DISPATCH_PAYLOAD_TEMPLATE } from "../shared/alertSimulation";

const dbMocks = vi.hoisted(() => ({
  listAlertTypes: vi.fn(),
  listDispatchedAlerts: vi.fn(),
  getWorkflowMonitor: vi.fn(),
  getDashboardMetrics: vi.fn(),
  getAlertTypeForUser: vi.fn(),
  updateAlertType: vi.fn(),
  getGeneralSettings: vi.fn(),
  updateGeneralSettings: vi.fn(),
  resetGeneratedOperationalData: vi.fn(),
}));
const mapMocks = vi.hoisted(() => ({ makeRequest: vi.fn() }));

vi.mock("./db", () => ({
  ...dbMocks,
}));
vi.mock("./_core/map", () => ({ ...mapMocks }));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: {
      id: 4,
      openId: "operador-teste",
      name: "Operador",
      email: "operador@exemplo.test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("procedimentos da central de alertas", () => {
  it("exige a frase de confirmação e remove somente os dados operacionais do usuário", async () => {
    dbMocks.resetGeneratedOperationalData.mockResolvedValue({ dispatchedAlerts: 3, receipts: 2, workflowOccurrences: 1, workflowLogs: 4 });
    const caller = appRouter.createCaller(context());

    await expect(caller.alerts.resetGeneratedData({ confirmation: "LIMPAR DADOS GERADOS" })).resolves.toEqual({ dispatchedAlerts: 3, receipts: 2, workflowOccurrences: 1, workflowLogs: 4 });
    expect(dbMocks.resetGeneratedOperationalData).toHaveBeenCalledWith(4);
    await expect(caller.alerts.resetGeneratedData({ confirmation: "apagar" } as never)).rejects.toThrow();
  });

  it("geocodifica um endereço para coordenadas gerais", async () => {
    mapMocks.makeRequest.mockResolvedValue({
      results: [{ formatted_address: "Praça dos Três Poderes, Brasília - DF", geometry: { location: { lat: -15.799765, lng: -47.864471 } } }],
      status: "OK",
    });
    const caller = appRouter.createCaller(context());

    await expect(caller.alerts.geocodeAddress({ address: "Praça dos Três Poderes, Brasília - DF" })).resolves.toEqual({
      formattedAddress: "Praça dos Três Poderes, Brasília - DF",
      latitude: -15.799765,
      longitude: -47.864471,
    });
    expect(mapMocks.makeRequest).toHaveBeenCalledWith("/maps/api/geocode/json", { address: "Praça dos Três Poderes, Brasília - DF" });
  });

  it("retorna e atualiza a coordenada padrão das configurações gerais", async () => {
    dbMocks.getGeneralSettings.mockResolvedValue({ userId: 4, defaultLatitude: -15.793889, defaultLongitude: -47.882778 });
    dbMocks.updateGeneralSettings.mockResolvedValue({ userId: 4, defaultLatitude: -23.55052, defaultLongitude: -46.633308 });
    const caller = appRouter.createCaller(context());

    await expect(caller.alerts.generalSettings()).resolves.toMatchObject({ defaultLatitude: -15.793889, defaultLongitude: -47.882778 });
    await expect(caller.alerts.updateGeneralSettings({ defaultLatitude: -23.55052, defaultLongitude: -46.633308 })).resolves.toMatchObject({ defaultLatitude: -23.55052, defaultLongitude: -46.633308 });
    expect(dbMocks.getGeneralSettings).toHaveBeenCalledWith(4);
    expect(dbMocks.updateGeneralSettings).toHaveBeenCalledWith(4, { defaultLatitude: -23.55052, defaultLongitude: -46.633308 });
  });

  it("lista as configurações iniciais das categorias sem expor o token", async () => {
    dbMocks.listAlertTypes.mockResolvedValue([
      {
        id: 1,
        userId: 4,
        category: "iluminacao_publica",
        name: "Iluminação pública",
        defaultDescription: "Luminária apagada em ponto público.",
        defaultSeverity: "media",
        endpointUrl: "mock://central-despacho",
        headersJson: "{}",
        authToken: "segredo-nao-exposto",
        payloadTemplate: "{}",
        isTestMode: true,
        autoEnabled: false,
        autoIntervalMinutes: 15,
        defaultLatitude: -15.793889,
        defaultLongitude: -47.882778,
        scheduleCronTaskUid: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const caller = appRouter.createCaller(context());

    const result = await caller.alerts.eventTypes();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 1, category: "iluminacao_publica", hasAuthToken: true });
    expect(result[0]).not.toHaveProperty("authToken");
  });

  it("retorna o histórico ordenado solicitado pelo operador", async () => {
    dbMocks.listDispatchedAlerts.mockResolvedValue([{ id: 90, status: "sucesso", narrative: "Ocorrência fictícia." }]);
    const caller = appRouter.createCaller(context());

    const result = await caller.alerts.history({ limit: 25 });

    expect(dbMocks.listDispatchedAlerts).toHaveBeenCalledWith(4, 25);
    expect(result).toEqual([{ id: 90, status: "sucesso", narrative: "Ocorrência fictícia." }]);
  });

  it("entrega ao operador o monitoramento de ocorrências e resultados do workflow", async () => {
    const monitor = {
      occurrences: [{ id: 8, code: "URB-001", title: "Semáforo apagado" }],
      logs: [{ id: 11, outcome: "accepted", httpStatus: 202, externalId: "EXT-001" }],
    };
    dbMocks.getWorkflowMonitor.mockResolvedValue(monitor);
    const caller = appRouter.createCaller(context());

    await expect(caller.alerts.workflowMonitor({ limit: 25 })).resolves.toEqual(monitor);
    expect(dbMocks.getWorkflowMonitor).toHaveBeenCalledWith(4, 25);
  });

  it("retorna um monitoramento vazio usando o limite padrão", async () => {
    dbMocks.getWorkflowMonitor.mockResolvedValue({ occurrences: [], logs: [] });
    const caller = appRouter.createCaller(context());

    await expect(caller.alerts.workflowMonitor()).resolves.toEqual({ occurrences: [], logs: [] });
    expect(dbMocks.getWorkflowMonitor).toHaveBeenCalledWith(4, 60);
  });

  it("valida e salva uma configuração REST por categoria", async () => {
    const current = {
      id: 1, userId: 4, category: "iluminacao_publica", name: "Iluminação pública",
      defaultDescription: "Luminária apagada em ponto público.", defaultSeverity: "media",
      endpointUrl: "mock://central-despacho", headersJson: "{}", authToken: null, payloadTemplate: "{}",
      isTestMode: true, autoEnabled: false, autoIntervalMinutes: 15, defaultLatitude: -15.793889, defaultLongitude: -47.882778, scheduleCronTaskUid: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    dbMocks.getAlertTypeForUser.mockResolvedValue(current);
    dbMocks.updateAlertType.mockResolvedValue({ ...current, name: "Iluminação — setor norte", authToken: "token-secreto" });
    const caller = appRouter.createCaller(context());

    const result = await caller.alerts.updateEventType({
      id: 1,
      name: "Iluminação — setor norte",
      defaultDescription: "Luminária apagada em ponto urbano prioritário.",
      defaultSeverity: "alta",
      endpointUrl: "https://central.exemplo.test/ocorrencias",
      headersJson: '{"x-origem":"simulador"}',
      authToken: "token-secreto",
      payloadTemplate: '{"narrativa":"{{narrative}}"}',
      isTestMode: false,
      defaultLatitude: -23.55052,
      defaultLongitude: -46.633308,
    });

    expect(dbMocks.updateAlertType).toHaveBeenCalledWith(4, 1, expect.objectContaining({
      endpointUrl: "https://central.exemplo.test/ocorrencias", defaultSeverity: "alta", authToken: "token-secreto", defaultLatitude: -23.55052, defaultLongitude: -46.633308,
    }));
    expect(result).toMatchObject({ name: "Iluminação — setor norte", hasAuthToken: true });
    expect(result).not.toHaveProperty("authToken");
  });

  it("aceita e salva o perfil AXE com latitude e longitude interpoladas", async () => {
    const current = {
      id: 2, userId: 4, category: "semaforos", name: "Semáforos", defaultDescription: "Falha em semáforo urbano.", defaultSeverity: "alta",
      endpointUrl: "mock://central-despacho", headersJson: "{}", authToken: null, payloadTemplate: "{}", isTestMode: true,
      autoEnabled: false, autoIntervalMinutes: 15, defaultLatitude: -15.793889, defaultLongitude: -47.882778, scheduleCronTaskUid: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    dbMocks.getAlertTypeForUser.mockResolvedValue(current);
    dbMocks.updateAlertType.mockResolvedValue({ ...current, payloadTemplate: AXE_DISPATCH_PAYLOAD_TEMPLATE });
    const caller = appRouter.createCaller(context());

    await expect(caller.alerts.updateEventType({
      id: 2, name: "Semáforos", defaultDescription: "Falha em semáforo urbano.", defaultSeverity: "alta",
      endpointUrl: "mock://central-despacho", headersJson: "{}", payloadTemplate: AXE_DISPATCH_PAYLOAD_TEMPLATE, isTestMode: true,
      defaultLatitude: -15.793889, defaultLongitude: -47.882778,
    })).resolves.toMatchObject({ id: 2 });

    expect(dbMocks.updateAlertType).toHaveBeenCalledWith(4, 2, expect.objectContaining({ payloadTemplate: AXE_DISPATCH_PAYLOAD_TEMPLATE }));
  });

  it("aceita e salva o perfil estrito ALRT → AXE em homologação", async () => {
    const current = {
      id: 3, userId: 4, category: "defesa_civil", name: "Defesa Civil", defaultDescription: "Risco urbano preventivo.", defaultSeverity: "alta",
      endpointUrl: "https://axe.exemplo.test/api/integrations/alrt/events", headersJson: "{}", authToken: null, payloadTemplate: "{}", isTestMode: true,
      autoEnabled: false, autoIntervalMinutes: 15, defaultLatitude: -15.793889, defaultLongitude: -47.882778, scheduleCronTaskUid: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    dbMocks.getAlertTypeForUser.mockResolvedValue(current);
    dbMocks.updateAlertType.mockResolvedValue({ ...current, payloadTemplate: ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE, apiKey: "chave-protegida" });
    const caller = appRouter.createCaller(context());

    await expect(caller.alerts.updateEventType({
      id: 3, name: "Defesa Civil", defaultDescription: "Risco urbano preventivo com triagem.", defaultSeverity: "alta",
      endpointUrl: "https://axe.exemplo.test/api/integrations/alrt/events", headersJson: "{}", apiKeyHeader: "X-ALRT-API-Key",
      payloadTemplate: ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE, isTestMode: true,
      defaultLatitude: -15.793889, defaultLongitude: -47.882778,
    })).resolves.toMatchObject({ id: 3 });

    expect(dbMocks.updateAlertType).toHaveBeenCalledWith(4, 3, expect.objectContaining({
      payloadTemplate: ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE,
      apiKeyHeader: "X-ALRT-API-Key",
    }));
  });

  it("entrega os contadores usados pelo dashboard", async () => {
    dbMocks.getDashboardMetrics.mockResolvedValue([{ category: "cameras", status: "falha", total: 2 }]);
    const caller = appRouter.createCaller(context());

    await expect(caller.alerts.metrics()).resolves.toEqual([{ category: "cameras", status: "falha", total: 2 }]);
  });
});
