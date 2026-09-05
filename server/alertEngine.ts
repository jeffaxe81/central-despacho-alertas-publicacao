import { nanoid } from "nanoid";
import type { AlertType } from "../drizzle/schema";
import { createHash, createHmac } from "node:crypto";
import * as db from "./db";
import { deliverToInternalMock } from "./mockDispatch";
import { logEvent } from "./observability/logger";
import { CONNECTORS } from "../shared/connectors/registry";
import type { ConnectorDescriptor } from "../shared/connectors/types";
import { DEFAULT_SIMULATION_COORDINATES, type EventCategory, type Severity } from "../shared/alertSimulation";

const STREETS = [
  "Rua das Flores",
  "Avenida Central",
  "Rua do Mercado",
  "Travessa do Sol",
  "Avenida das Palmeiras",
  "Rua do Mirante",
  "Rua da Estação",
  "Alameda dos Ipês",
];

const NEIGHBORHOODS = [
  "Jardim Aurora",
  "Centro Cívico",
  "Vila Esperança",
  "Parque das Águas",
  "Santa Clara",
  "Boa Vista",
  "Nova Horizonte",
  "Lago Norte",
];

const CROSS_STREETS = [
  "Av. Central",
  "Rua do Comércio",
  "Rua das Acácias",
  "Avenida Norte",
  "Rua do Bosque",
];

const CATEGORY_NARRATIVES: Record<EventCategory, (location: GeneratedLocation) => string[]> = {
  iluminacao_publica: location => [
    `Ponto de iluminação apagado em ${location.address}, no bairro ${location.neighborhood}, reduzindo a visibilidade da via durante o período noturno.`,
    `Moradores relataram luminária intermitente em ${location.address}, próximo a ${location.crossStreet}, com impacto na segurança de pedestres.`,
  ],
  seguranca_municipal: location => [
    `Solicitação de verificação preventiva em ${location.address}, no bairro ${location.neighborhood}, após relato de movimentação incomum na área pública.`,
    `Central recebeu alerta de apoio à segurança municipal em ${location.address}, próximo a ${location.crossStreet}, para averiguação da equipe de patrulhamento.`,
  ],
  defesa_civil: location => [
    `Sinalizada condição de risco preventivo em ${location.address}, no bairro ${location.neighborhood}, com necessidade de vistoria da Defesa Civil.`,
    `Ocorrência de possível instabilidade em área urbana registrada em ${location.address}, próximo a ${location.crossStreet}; recomenda-se avaliação técnica preventiva.`,
  ],
  semaforos: location => [
    `Sinaleira apagada em ${location.address}, causando transtorno no trânsito no cruzamento com ${location.crossStreet}.`,
    `Equipamento semafórico operando em modo intermitente em ${location.address}, no bairro ${location.neighborhood}, exigindo sinalização e inspeção.`,
  ],
  cameras: location => [
    `Câmera de videomonitoramento indisponível em ${location.address}, no bairro ${location.neighborhood}, reduzindo a cobertura do ponto monitorado.`,
    `Falha de comunicação identificada na câmera urbana próxima a ${location.address}, junto a ${location.crossStreet}; equipe técnica deve verificar o enlace.`,
  ],
  botao_perigo: location => [
    `Botão de perigo acionado em ${location.address}, no bairro ${location.neighborhood}; solicita-se prioridade para verificação preventiva no local.`,
    `Alerta preventivo de pânico recebido em ${location.address}, próximo a ${location.crossStreet}, com recomendação de envio imediato de equipe de apoio.`,
  ],
};

export type GeneratedLocation = {
  address: string;
  neighborhood: string;
  crossStreet: string;
};

export type GeneratedOccurrence = GeneratedLocation & {
  eventId: string;
  correlationId: string;
  seed: string;
  timestamp: string;
  narrative: string;
  severity: Severity;
  latitude: number;
  longitude: number;
};

type TemplateContext = Record<string, string | number | boolean>;

const AXE_PRIORITY: Record<Severity, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
  baixa: "LOW",
  media: "MEDIUM",
  alta: "HIGH",
  critica: "CRITICAL",
};

function choose<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)] as T;
}

function correlationIdFrom(seed: string, timestamp: string) {
  const hex = createHash("sha256").update(`${seed}:${timestamp}`).digest("hex");
  return `corr_${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateOccurrence(
  category: EventCategory,
  severity: Severity,
  random: (() => number) | undefined = undefined,
  now = new Date(),
  suppliedSeed?: string,
  coordinateOverride?: { latitude: number; longitude: number }
): GeneratedOccurrence {
  const seed = suppliedSeed ?? nanoid(14);
  const seededRandom = random ?? createSeededRandom(seed);
  const street = choose(STREETS, seededRandom);
  const address = `${street}, nº ${Math.floor(seededRandom() * 980) + 12}`;
  const location: GeneratedLocation = {
    address,
    neighborhood: choose(NEIGHBORHOODS, seededRandom),
    crossStreet: choose(CROSS_STREETS, seededRandom),
  };
  const latitude = Number((coordinateOverride?.latitude ?? DEFAULT_SIMULATION_COORDINATES.latitude).toFixed(6));
  const longitude = Number((coordinateOverride?.longitude ?? DEFAULT_SIMULATION_COORDINATES.longitude).toFixed(6));
  const narrative = `${choose(CATEGORY_NARRATIVES[category](location), seededRandom)} Referência geográfica: latitude ${latitude}, longitude ${longitude}.`;

  return {
    ...location,
    eventId: `SIM-${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${seed.toUpperCase().slice(0, 6)}`,
    correlationId: correlationIdFrom(seed, now.toISOString()),
    seed,
    timestamp: now.toISOString(),
    narrative,
    severity,
    latitude,
    longitude,
  };
}

export function parseHeaders(headersJson: string): Record<string, string> {
  let candidate: unknown;
  try {
    candidate = JSON.parse(headersJson || "{}");
  } catch {
    throw new Error("Os cabeçalhos precisam estar em JSON válido.");
  }
  if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") {
    throw new Error("Os cabeçalhos devem ser um objeto JSON de pares texto-valor.");
  }
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (typeof value !== "string") {
      throw new Error(`O valor do cabeçalho ${key} deve ser texto.`);
    }
    headers[key] = value;
  }
  return headers;
}

function hasHeader(headers: Record<string, string>, name: string) {
  return Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase());
}

function headerValue(headers: Record<string, string>, name: string) {
  const key = Object.keys(headers).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

export function createAlrtHmacSignature(secret: string, timestamp: string, rawBody: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex")}`;
}

function addPayloadCorrelationHeaders(headers: Record<string, string>, payload: Record<string, unknown>) {
  const eventId = typeof payload.eventId === "string" ? payload.eventId : undefined;
  const eventType = typeof payload.eventType === "string" ? payload.eventType : undefined;
  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : undefined;
  const correlationId = typeof payload.correlationId === "string" ? payload.correlationId : undefined;
  if (eventId && !hasHeader(headers, "x-event-id")) headers["x-event-id"] = eventId;
  if (eventType && !hasHeader(headers, "x-event-type")) headers["x-event-type"] = eventType;
  if (idempotencyKey && !hasHeader(headers, "idempotency-key")) headers["idempotency-key"] = idempotencyKey;
  if (correlationId && !hasHeader(headers, "x-correlation-id")) headers["x-correlation-id"] = correlationId;
  if (eventId && !hasHeader(headers, "x-timestamp")) headers["x-timestamp"] = new Date().toISOString();
  if (eventId && !hasHeader(headers, "x-request-timestamp")) headers["x-request-timestamp"] = headerValue(headers, "x-timestamp") ?? new Date().toISOString();
}

export const eventTypeDiscriminator = "eventType";

/** Identifica, pelo campo eventType do payload interpolado, a qual conector registrado ele corresponde. */
export function matchConnectorByPayload(payload: Record<string, unknown>): ConnectorDescriptor | undefined {
  const eventType = typeof payload[eventTypeDiscriminator] === "string" ? (payload[eventTypeDiscriminator] as string) : undefined;
  if (!eventType) return undefined;
  return CONNECTORS.find(connector => connector.payloadTemplate.includes(`"eventType": "${eventType}"`));
}

export function retryDelayFromResponse(response: Response, fallbackMilliseconds: number) {
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (!retryAfter) return fallbackMilliseconds;
  if (/^\d+$/.test(retryAfter)) return Math.min(Number(retryAfter) * 1000, 45_000);
  const dateMilliseconds = Date.parse(retryAfter);
  if (!Number.isFinite(dateMilliseconds)) return fallbackMilliseconds;
  return Math.min(Math.max(dateMilliseconds - Date.now(), 0), 45_000);
}

export function interpolatePayload(template: string, context: TemplateContext): Record<string, unknown> {
  const rendered = template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    const value = context[key];
    if (value === undefined) return "";
    return JSON.stringify(String(value)).slice(1, -1);
  });
  try {
    const payload: unknown = JSON.parse(rendered);
    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
      throw new Error("O payload deve ser um objeto JSON.");
    }
    return payload as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erro desconhecido";
    throw new Error(`O modelo de payload não resultou em JSON válido: ${detail}`);
  }
}

export function intervalToCron(intervalMinutes: number): string {
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 1440) {
    throw new Error("O intervalo automático deve estar entre 5 e 1440 minutos.");
  }
  if (intervalMinutes < 60 && 60 % intervalMinutes === 0) {
    return `0 */${intervalMinutes} * * * *`;
  }
  if (intervalMinutes % 60 === 0) {
    const hours = intervalMinutes / 60;
    if (24 % hours === 0) return `0 0 */${hours} * * *`;
  }
  throw new Error("Escolha um intervalo compatível: 5, 10, 15, 20, 30, 60, 120, 180, 360, 720 ou 1440 minutos.");
}

function assertPublicHttpUrl(endpointUrl: string, allowPrivateEndpointForTest = false) {
  if (endpointUrl.startsWith("mock://")) return;
  let url: URL;
  try {
    url = new URL(endpointUrl);
  } catch {
    throw new Error("Informe um endpoint HTTP ou HTTPS válido.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("O endpoint deve utilizar HTTP, HTTPS ou o mock interno.");
  }
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  if (privateHost && !allowPrivateEndpointForTest) {
    throw new Error("Para segurança, o simulador aceita apenas endpoints públicos acessíveis por HTTPS/HTTP.");
  }
}

async function wait(milliseconds: number) {
  await new Promise(resolve => setTimeout(resolve, milliseconds));
}

export function alrtRetryDelayMilliseconds(attempt: number) {
  return [5_000, 15_000, 45_000][Math.max(0, Math.min(attempt - 1, 2))]!;
}

export async function postWithRetry(input: {
  endpointUrl: string;
  headers: Record<string, string>;
  authToken?: string | null;
  apiKey?: string | null;
  apiKeyHeader?: string;
  hmacSecret?: string;
  allowPrivateEndpointForTest?: boolean;
  retryDelayMilliseconds?: (attempt: number) => number;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; status: number | null; summary: string; attempts: number; failureReason?: string }> {
  assertPublicHttpUrl(input.endpointUrl, input.allowPrivateEndpointForTest);
  const headers: Record<string, string> = { "content-type": "application/json", ...input.headers };
  const hasAuthorization = hasHeader(headers, "authorization");
  if (input.authToken && !hasAuthorization) headers.authorization = `Bearer ${input.authToken}`;
  if (input.apiKey) headers[input.apiKeyHeader?.trim() || "x-api-key"] = input.apiKey;
  addPayloadCorrelationHeaders(headers, input.payload);
  const rawBody = JSON.stringify(input.payload);
  if (input.hmacSecret) {
    const timestamp = headerValue(headers, "x-timestamp");
    if (!timestamp) throw new Error("Não foi possível criar o timestamp para assinatura HMAC.");
    headers["x-signature"] = createAlrtHmacSignature(input.hmacSecret, timestamp, rawBody);
  }

  let lastError = "Falha de comunicação sem detalhe disponível.";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(input.endpointUrl, {
        method: "POST",
        headers,
        body: rawBody,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const body = (await response.text()).slice(0, 800);
      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          summary: body || "Resposta recebida sem corpo.",
          attempts: attempt,
        };
      }
      lastError = `Resposta HTTP ${response.status}: ${body || response.statusText}`;
      if ((response.status < 500 && response.status !== 429) || attempt === 3) {
        return { ok: false, status: response.status, summary: body, attempts: attempt, failureReason: lastError };
      }
      const retryDelay = input.retryDelayMilliseconds?.(attempt) ?? alrtRetryDelayMilliseconds(attempt);
      await wait(response.status === 429 ? retryDelayFromResponse(response, retryDelay) : retryDelay);
      continue;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error.message : "Erro de rede desconhecido.";
      if (attempt === 3) return { ok: false, status: null, summary: "", attempts: attempt, failureReason: lastError };
    }
    await wait(input.retryDelayMilliseconds?.(attempt) ?? alrtRetryDelayMilliseconds(attempt));
  }
  return { ok: false, status: null, summary: "", attempts: 3, failureReason: lastError };
}

export async function dispatchConfiguredAlert(
  alertType: AlertType,
  coordinateOverride?: { latitude: number; longitude: number },
  generalCoordinates?: { latitude: number; longitude: number }
) {
  const effectiveCoordinates = coordinateOverride ?? (alertType.useGeneralLocation ? generalCoordinates : undefined);
  const occurrence = generateOccurrence(alertType.category, alertType.defaultSeverity, undefined, undefined, undefined, {
    latitude: effectiveCoordinates?.latitude ?? alertType.defaultLatitude,
    longitude: effectiveCoordinates?.longitude ?? alertType.defaultLongitude,
  });
  const effectiveEndpointUrl = alertType.isTestMode ? "mock://central-despacho" : alertType.endpointUrl;
  const context: TemplateContext = {
    alertId: occurrence.eventId,
    category: alertType.category,
    eventName: alertType.name,
    severity: occurrence.severity,
    axePriority: AXE_PRIORITY[occurrence.severity],
    timestamp: occurrence.timestamp,
    address: occurrence.address,
    neighborhood: occurrence.neighborhood,
    latitude: occurrence.latitude,
    longitude: occurrence.longitude,
    coordinates: `${occurrence.latitude},${occurrence.longitude}`,
    narrative: occurrence.narrative,
    correlationId: occurrence.correlationId,
    isTestMode: alertType.isTestMode,
  };
  const interpolatedPayload = interpolatePayload(alertType.payloadTemplate, context);
  const nestedLocation = interpolatedPayload.location;
  const matchedConnector = matchConnectorByPayload(interpolatedPayload);
  const isAlrtAxeEnvelope = matchedConnector?.id === "axe-dispatch" &&
    typeof interpolatedPayload.eventId === "string" &&
    typeof interpolatedPayload.idempotencyKey === "string";
  const payload = {
    ...interpolatedPayload,
    ...(!isAlrtAxeEnvelope ? {
      latitude: occurrence.latitude,
      longitude: occurrence.longitude,
      coordinates: `${occurrence.latitude},${occurrence.longitude}`,
    } : {}),
    ...(nestedLocation && typeof nestedLocation === "object" && !Array.isArray(nestedLocation)
      ? { location: { ...nestedLocation, latitude: occurrence.latitude, longitude: occurrence.longitude } }
      : {}),
  };
  const payloadJson = JSON.stringify(payload);
  const alertId = await db.createDispatchedAlert({
    userId: alertType.userId,
    alertTypeId: alertType.id,
    category: alertType.category,
    eventName: alertType.name,
    address: occurrence.address,
    neighborhood: occurrence.neighborhood,
    latitude: occurrence.latitude,
    longitude: occurrence.longitude,
    narrative: occurrence.narrative,
    severity: occurrence.severity,
    endpointUrl: effectiveEndpointUrl,
    payloadJson,
    isSimulated: true,
    simulationSeed: occurrence.seed,
  });

  try {
    if (matchedConnector?.status === "proposta" && !alertType.isTestMode) {
      logEvent("warn", "dispatch.blocked_proposta", {
        correlationId: occurrence.correlationId,
        eventId: occurrence.eventId,
        userId: alertType.userId,
        alertTypeId: alertType.id,
        connectorId: matchedConnector.id,
        category: alertType.category,
      });
      throw new Error(
        `O conector "${matchedConnector.label}" ainda é uma proposta sem contrato oficial confirmado; envio fora do modo teste está bloqueado (ver relatorio-conformidade-master.md).`
      );
    }
    if (!alertType.isTestMode && isAlrtAxeEnvelope && !alertType.apiKey?.trim()) {
      throw new Error("Configure a API key X-ALRT-API-Key antes do envio ALRT → AXE.");
    }
    logEvent("info", "dispatch.attempt", {
      correlationId: occurrence.correlationId,
      eventId: occurrence.eventId,
      userId: alertType.userId,
      alertTypeId: alertType.id,
      connectorId: matchedConnector?.id,
      category: alertType.category,
      isTestMode: alertType.isTestMode,
    });
    const result = alertType.isTestMode
      ? await deliverToInternalMock({ userId: alertType.userId, dispatchedAlertId: alertId, payloadJson })
      : await postWithRetry({
          endpointUrl: alertType.endpointUrl,
          headers: parseHeaders(alertType.headersJson),
          authToken: alertType.authToken,
          apiKey: alertType.apiKey,
          apiKeyHeader: alertType.apiKeyHeader,
          hmacSecret: isAlrtAxeEnvelope
            ? (() => {
                const secret = process.env.AXE_HMAC_SECRET;
                if (!secret || secret.length < 32) throw new Error("Configure AXE_HMAC_SECRET com pelo menos 32 caracteres antes do envio ALRT → AXE.");
                return secret;
              })()
            : undefined,
          payload,
        });
    await db.updateDispatchedAlert(alertId, {
      status: result.ok ? "sucesso" : "falha",
      responseHttpStatus: result.status,
      responseSummary: result.summary || null,
      failureReason: result.failureReason ?? null,
      attemptCount: result.attempts,
    });
    logEvent(result.ok ? "info" : "warn", result.ok ? "dispatch.success" : "dispatch.failure", {
      correlationId: occurrence.correlationId,
      eventId: occurrence.eventId,
      userId: alertType.userId,
      alertTypeId: alertType.id,
      connectorId: matchedConnector?.id,
      category: alertType.category,
      attempt: result.attempts,
      httpStatus: result.status,
    });
    return { alertId, occurrence, payload, ...result };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "Erro desconhecido ao preparar despacho.";
    await db.updateDispatchedAlert(alertId, {
      status: "falha",
      responseHttpStatus: null,
      responseSummary: null,
      failureReason,
      attemptCount: 0,
    });
    logEvent("error", "dispatch.exception", {
      correlationId: occurrence.correlationId,
      eventId: occurrence.eventId,
      userId: alertType.userId,
      alertTypeId: alertType.id,
      connectorId: matchedConnector?.id,
      category: alertType.category,
      reason: failureReason,
    });
    return { alertId, occurrence, payload, ok: false, status: null, summary: "", attempts: 0, failureReason };
  }
}
