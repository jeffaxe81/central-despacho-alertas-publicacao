import type { AlertType } from "../drizzle/schema";
import type { Severity } from "../shared/alertSimulation";
import * as db from "./db";
import { deliverToInternalMock } from "./mockDispatch";
import { publishEvent } from "./eventBus/publish";
import { logEvent } from "./observability/logger";
import {
  dispatchConfiguredAlert as dispatchConfiguredAlertLegacy,
  generateOccurrence,
  interpolatePayload,
  matchConnectorByPayload,
  type GeneratedOccurrence,
} from "./alertEngineLegacy";

const AXE_PRIORITY: Record<Severity, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
  baixa: "LOW",
  media: "MEDIUM",
  alta: "HIGH",
  critica: "CRITICAL",
};

function isAlrtAxeTemplate(payloadTemplate: string) {
  return /"eventType"\s*:\s*"alert\.received"/.test(payloadTemplate);
}

export function createCanonicalAlrtAxeEvent(
  alertType: Pick<AlertType, "name">,
  occurrence: GeneratedOccurrence
) {
  return {
    specversion: "1.0" as const,
    id: `evt_${occurrence.eventId}`,
    source: "urn:axesistemas:motor-eventos:alertas",
    type: "com.axesistemas.alerta.urbano.recebido.v1",
    subject: `alerta/${occurrence.eventId}`,
    time: occurrence.timestamp,
    datacontenttype: "application/json" as const,
    dataschema: "urn:axesistemas:schema:alerta:urbano:1.0.0",
    correlationid: occurrence.correlationId,
    idempotencykey: `alrt:alert:${occurrence.eventId}:created:v1`,
    axesrunid: `run:${occurrence.eventId}`,
    axesscenarioid: "alrt-axe-shadow",
    axesscenarioversion: "1.0.0",
    axesseed: occurrence.seed,
    axessequence: 1,
    axessimulated: true as const,
    data: {
      assetId: occurrence.eventId,
      category: alertType.name,
      severity: occurrence.severity,
      description: occurrence.narrative,
      location: {
        address: occurrence.address,
        latitude: occurrence.latitude,
        longitude: occurrence.longitude,
      },
    },
  };
}

/**
 * MUE-004: somente o caminho ALRT -> AXE em modo teste gera o contrato
 * canônico antes da fronteira do mock. Todos os demais cenários continuam
 * delegados integralmente ao dispatcher legado, inclusive qualquer envio real.
 */
export async function dispatchConfiguredAlert(
  alertType: AlertType,
  coordinateOverride?: { latitude: number; longitude: number },
  generalCoordinates?: { latitude: number; longitude: number }
) {
  if (!alertType.isTestMode || !isAlrtAxeTemplate(alertType.payloadTemplate)) {
    return dispatchConfiguredAlertLegacy(alertType, coordinateOverride, generalCoordinates);
  }

  const effectiveCoordinates = coordinateOverride ?? (alertType.useGeneralLocation ? generalCoordinates : undefined);
  const occurrence = generateOccurrence(alertType.category, alertType.defaultSeverity, undefined, undefined, undefined, {
    latitude: effectiveCoordinates?.latitude ?? alertType.defaultLatitude,
    longitude: effectiveCoordinates?.longitude ?? alertType.defaultLongitude,
  });
  const context = {
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
  const payload = interpolatePayload(alertType.payloadTemplate, context);
  const matchedConnector = matchConnectorByPayload(payload);
  const isAlrtAxeEnvelope = matchedConnector?.id === "axe-dispatch" &&
    typeof payload.eventId === "string" &&
    typeof payload.idempotencyKey === "string";

  if (!isAlrtAxeEnvelope) {
    return dispatchConfiguredAlertLegacy(alertType, coordinateOverride, generalCoordinates);
  }

  const canonicalEvent = createCanonicalAlrtAxeEvent(alertType, occurrence);
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
    endpointUrl: "mock://central-despacho",
    payloadJson,
    isSimulated: true,
    simulationSeed: occurrence.seed,
  });

  await publishEvent({
    userId: alertType.userId,
    tenantId: alertType.tenantId,
    correlationId: occurrence.correlationId,
    eventId: occurrence.eventId,
    category: alertType.category,
    connectorId: matchedConnector.id,
    payload,
  });

  try {
    logEvent("info", "dispatch.attempt", {
      correlationId: occurrence.correlationId,
      eventId: occurrence.eventId,
      userId: alertType.userId,
      alertTypeId: alertType.id,
      connectorId: matchedConnector.id,
      category: alertType.category,
      isTestMode: true,
    });

    const result = await deliverToInternalMock({
      userId: alertType.userId,
      dispatchedAlertId: alertId,
      payloadJson,
      canonicalEvent,
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
      connectorId: matchedConnector.id,
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
      connectorId: matchedConnector.id,
      category: alertType.category,
      reason: failureReason,
    });
    return { alertId, occurrence, payload, ok: false, status: null, summary: "", attempts: 0, failureReason };
  }
}
