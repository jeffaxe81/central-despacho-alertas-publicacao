import { afterEach, describe, expect, it, vi } from "vitest";
import type { AlertType } from "../drizzle/schema";
import { createHmac } from "node:crypto";
import express from "express";
import { ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE, AXE_DISPATCH_PAYLOAD_TEMPLATE } from "../shared/alertSimulation";
import {
  dispatchConfiguredAlert,
  createAlrtHmacSignature,
  alrtRetryDelayMilliseconds,
  generateOccurrence,
  interpolatePayload,
  intervalToCron,
  parseHeaders,
  postWithRetry,
  retryDelayFromResponse,
} from "./alertEngine";
import * as db from "./db";

vi.mock("./db", () => ({
  createDispatchedAlert: vi.fn(),
  updateDispatchedAlert: vi.fn(),
  recordMockReceipt: vi.fn(),
}));

const mockDb = vi.mocked(db);
const originalFetch = global.fetch;
const hmacTestSecret = process.env.AXE_HMAC_SECRET ?? "segredo-de-teste-axe-com-32-caracteres";

const mockAlertType: AlertType = {
  id: 10,
  userId: 7,
  category: "semaforos",
  name: "Falha semafórica",
  defaultDescription: "Falha simulada de semáforo.",
  defaultSeverity: "alta",
  endpointUrl: "mock://central-despacho",
  headersJson: "{}",
  authToken: null,
  payloadTemplate: JSON.stringify({ narrativa: "{{narrative}}", endereco: "{{address}}" }),
  isTestMode: true,
  autoEnabled: false,
  autoIntervalMinutes: 15,
  defaultLatitude: -23.55052,
  defaultLongitude: -46.633308,
  useGeneralLocation: true,
  scheduleCronTaskUid: null,
  simulationSeed: "semente-teste",
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe("gerador de alertas urbanos", () => {
  it("gera endereço, severidade, timestamp e narrativa contextualizada para semáforos", () => {
    const occurrence = generateOccurrence("semaforos", "alta", () => 0.1, new Date("2026-08-21T12:00:00.000Z"));

    expect(occurrence.address).toContain("nº");
    expect(occurrence.neighborhood).not.toHaveLength(0);
    expect(occurrence.severity).toBe("alta");
    expect(occurrence.timestamp).toBe("2026-08-21T12:00:00.000Z");
    expect(occurrence.narrative).toMatch(/Sinaleira|semafórico/i);
    expect(occurrence.eventId).toMatch(/^SIM-/);
    expect(occurrence.correlationId).toMatch(/^corr_[a-f0-9]{8}-/);
  });

  it("mantém narrativas contextualizadas para o botão de perigo", () => {
    const occurrence = generateOccurrence("botao_perigo", "critica", () => 0.2);
    expect(occurrence.narrative).toMatch(/perigo|pânico/i);
    expect(occurrence.severity).toBe("critica");
  });

  it("reproduz exatamente a mesma ocorrência quando recebe a mesma semente", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const first = generateOccurrence("cameras", "media", undefined, now, "camera-norte-17");
    const second = generateOccurrence("cameras", "media", undefined, now, "camera-norte-17");

    expect(second).toEqual(first);
    expect(first.seed).toBe("camera-norte-17");
  });
});

describe("validação de cabeçalhos e payload", () => {
  it("aceita cabeçalhos JSON de texto", () => {
    expect(parseHeaders('{"x-origem":"simulador","x-lote":"teste"}')).toEqual({
      "x-origem": "simulador",
      "x-lote": "teste",
    });
  });

  it("rejeita cabeçalhos inválidos ou valores não textuais", () => {
    expect(() => parseHeaders("[1, 2]")).toThrow(/objeto JSON/i);
    expect(() => parseHeaders('{"tentativas":3}')).toThrow(/deve ser texto/i);
  });

  it("interpela variáveis e produz um objeto JSON válido", () => {
    const payload = interpolatePayload('{"id":"{{alertId}}","endereco":"{{address}}","simulado":true}', {
      alertId: "SIM-42",
      address: "Rua das Flores, nº 142",
    });
    expect(payload).toEqual({ id: "SIM-42", endereco: "Rua das Flores, nº 142", simulado: true });
  });

  it("escapa caracteres especiais para preservar o JSON do contrato", () => {
    const payload = interpolatePayload('{"descricao":"{{narrative}}","endereco":"{{address}}"}', {
      narrative: 'Relato com aspas "e quebra\nde linha".',
      address: "Rua d'Água, nº 5",
    });
    expect(payload).toEqual({ descricao: 'Relato com aspas "e quebra\nde linha".', endereco: "Rua d'Água, nº 5" });
  });

  it("rejeita modelo que deixa de ser JSON após a interpolação", () => {
    expect(() => interpolatePayload('{"endereco": {{address}}}', { address: "Rua 1" })).toThrow(/JSON válido/i);
  });
});

describe("despacho e histórico", () => {
  it("faz retry para resposta 5xx e confirma a entrega na segunda tentativa", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("indisponível", { status: 503 }))
      .mockResolvedValueOnce(new Response("aceito", { status: 202 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await postWithRetry({
      endpointUrl: "https://central.exemplo.test/alertas",
      headers: { "x-origem": "teste" },
      retryDelayMilliseconds: () => 0,
      payload: { codigo: "SIM-1" },
    });

    expect(result).toMatchObject({ ok: true, status: 202, attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("envia a API key no cabeçalho configurado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("aceito", { status: 202 }));
    global.fetch = fetchMock as typeof fetch;

    await postWithRetry({
      endpointUrl: "https://central.exemplo.test/alertas",
      headers: { "x-origem": "teste" },
      apiKey: "chave-teste-protegida",
      apiKeyHeader: "x-integration-key",
      payload: { codigo: "SIM-API-1" },
    });

    expect(fetchMock).toHaveBeenCalledWith("https://central.exemplo.test/alertas", expect.objectContaining({
      headers: expect.objectContaining({ "x-integration-key": "chave-teste-protegida" }),
    }));
  });

  it("inclui headers de correlação e repete após limite de taxa", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("aguarde", { status: 429, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(new Response("aceito", { status: 202 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await postWithRetry({
      endpointUrl: "https://central.exemplo.test/alertas",
      headers: {},
      retryDelayMilliseconds: () => 0,
      payload: { eventId: "evt-42", eventType: "alert.received", correlationId: "corr-42", idempotencyKey: "alert-42-created" },
    });

    expect(result).toMatchObject({ ok: true, status: 202, attempts: 2 });
    expect(fetchMock).toHaveBeenCalledWith("https://central.exemplo.test/alertas", expect.objectContaining({
      headers: expect.objectContaining({ "x-event-id": "evt-42", "x-event-type": "alert.received", "idempotency-key": "alert-42-created", "x-correlation-id": "corr-42", "x-timestamp": expect.any(String), "x-request-timestamp": expect.any(String) }),
    }));
    expect(retryDelayFromResponse(new Response(null, { headers: { "Retry-After": "2" } }), 300)).toBe(2000);
    expect([1, 2, 3].map(alrtRetryDelayMilliseconds)).toEqual([5_000, 15_000, 45_000]);
  });

  it("assina o corpo bruto com o segredo HMAC configurado e entrega ao receptor leve", async () => {
    const secret = hmacTestSecret;
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const app = express();
    app.use(express.text({ type: "application/json" }));
    app.post("/health", (request, response) => {
      const timestamp = request.header("x-timestamp") ?? "";
      const expected = createHmac("sha256", secret).update(`${timestamp}.${request.body}`, "utf8").digest("hex");
      const signature = request.header("x-signature");
      if (signature !== `sha256=${expected}`) return response.status(401).json({ status: "INVALID_SIGNATURE" });
      return response.status(200).json({ status: "ready" });
    });
    const server = await new Promise<ReturnType<typeof app.listen>>(resolve => {
      const listeningServer = app.listen(0, () => resolve(listeningServer));
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Servidor de teste indisponível");
      const payload = { eventId: "evt-hmac-1", eventType: "alert.received", correlationId: "corr-hmac-1", idempotencyKey: "alrt:alert:hmac:1" };
      const result = await postWithRetry({ endpointUrl: `http://127.0.0.1:${address.port}/health`, headers: {}, hmacSecret: secret, allowPrivateEndpointForTest: true, payload });
      expect(result).toMatchObject({ ok: true, status: 200, attempts: 1 });
      expect(createAlrtHmacSignature(secret, "2026-08-22T14:30:00.000Z", '{"ok":true}')).toMatch(/^sha256=[a-f0-9]{64}$/);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("registra alerta, entrega mock e recebimento interno", async () => {
    mockDb.createDispatchedAlert.mockResolvedValue(88);
    mockDb.updateDispatchedAlert.mockResolvedValue(undefined);
    mockDb.recordMockReceipt.mockResolvedValue(undefined);

    const result = await dispatchConfiguredAlert(mockAlertType);

    expect(result).toMatchObject({ ok: true, status: 202, attempts: 1, alertId: 88 });
    expect(result.occurrence).toMatchObject({ latitude: -23.55052, longitude: -46.633308 });
    expect(result.payload).toMatchObject({ latitude: -23.55052, longitude: -46.633308, coordinates: "-23.55052,-46.633308" });
    expect(mockDb.createDispatchedAlert).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      alertTypeId: 10,
      category: "semaforos",
      isSimulated: true,
      simulationSeed: expect.any(String),
      latitude: -23.55052,
      longitude: -46.633308,
    }));
    expect(mockDb.updateDispatchedAlert).toHaveBeenCalledWith(88, expect.objectContaining({
      status: "sucesso",
      responseHttpStatus: 202,
      attemptCount: 1,
    }));
    expect(mockDb.recordMockReceipt).toHaveBeenCalledWith(expect.objectContaining({ dispatchedAlertId: 88, userId: 7 }));
  });

  it("usa a localização geral quando a categoria não possui coordenada própria", async () => {
    mockDb.createDispatchedAlert.mockResolvedValue(89);
    mockDb.updateDispatchedAlert.mockResolvedValue(undefined);
    mockDb.recordMockReceipt.mockResolvedValue(undefined);

    const result = await dispatchConfiguredAlert(mockAlertType, undefined, { latitude: -15.794229, longitude: -47.882166 });

    expect(result.occurrence).toMatchObject({ latitude: -15.794229, longitude: -47.882166 });
  });

  it("prioriza a coordenada escolhida diretamente no simulador para uma ocorrência", async () => {
    mockDb.createDispatchedAlert.mockResolvedValue(89);
    mockDb.updateDispatchedAlert.mockResolvedValue(undefined);
    mockDb.recordMockReceipt.mockResolvedValue(undefined);

    const result = await dispatchConfiguredAlert(mockAlertType, { latitude: -22.906847, longitude: -43.172896 });

    expect(result.occurrence).toMatchObject({ latitude: -22.906847, longitude: -43.172896 });
    expect(result.payload).toMatchObject({ coordinates: "-22.906847,-43.172896" });
  });

  it("monta o perfil AXE com prioridade normalizada e coordenadas", async () => {
    mockDb.createDispatchedAlert.mockResolvedValue(90);
    mockDb.updateDispatchedAlert.mockResolvedValue(undefined);
    mockDb.recordMockReceipt.mockResolvedValue(undefined);

    const result = await dispatchConfiguredAlert({ ...mockAlertType, payloadTemplate: AXE_DISPATCH_PAYLOAD_TEMPLATE });

    expect(result.payload).toMatchObject({
      id: expect.stringMatching(/^SIM-/),
      priority: "HIGH",
      status: "NEW",
      eventType: "semaforos",
      location: { latitude: -23.55052, longitude: -46.633308 },
    });
  });

  it("monta o envelope seguro ALRT para o receptor AXE em homologação", async () => {
    mockDb.createDispatchedAlert.mockResolvedValue(91);
    mockDb.updateDispatchedAlert.mockResolvedValue(undefined);
    mockDb.recordMockReceipt.mockResolvedValue(undefined);

    const result = await dispatchConfiguredAlert({ ...mockAlertType, payloadTemplate: ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE });

    expect(result.payload).toMatchObject({
      schemaVersion: "1.0",
      eventId: expect.stringMatching(/^evt_SIM-/),
      eventType: "alert.received",
      source: { system: "despacho-alrt", environment: "homologacao" },
      correlationId: expect.stringMatching(/^corr_[a-f0-9]{8}-/),
      idempotencyKey: expect.stringMatching(/^alrt:alert:SIM-/),
      data: { alert: { priority: "alta", latitude: -23.55052, longitude: -46.633308, sourceStatus: "novo" } },
    });
    expect(result.payload).not.toHaveProperty("latitude");
    expect(result.payload).not.toHaveProperty("longitude");
    expect(result.payload).not.toHaveProperty("coordinates");
  });

  it("bloqueia o perfil ALRT → AXE sem API key antes de chamar o receptor", async () => {
    mockDb.createDispatchedAlert.mockResolvedValue(92);
    mockDb.updateDispatchedAlert.mockResolvedValue(undefined);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const result = await dispatchConfiguredAlert({
      ...mockAlertType,
      isTestMode: false,
      endpointUrl: "https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events",
      apiKey: null,
      payloadTemplate: ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE,
    });

    expect(result).toMatchObject({ ok: false, attempts: 0, failureReason: expect.stringMatching(/API key X-ALRT-API-Key/i) });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockDb.updateDispatchedAlert).toHaveBeenCalledWith(92, expect.objectContaining({ status: "falha", attemptCount: 0 }));
  });
});

describe("intervalos de automação", () => {
  it("converte intervalos aceitos em cron de seis campos", () => {
    expect(intervalToCron(15)).toBe("0 */15 * * * *");
    expect(intervalToCron(120)).toBe("0 0 */2 * * *");
  });

  it("rejeita intervalos que não podem ser agendados de forma segura", () => {
    expect(() => intervalToCron(7)).toThrow(/Escolha um intervalo compatível/i);
  });
});
