import type { Request, Response } from "express";
import { isDeepStrictEqual } from "node:util";
import { toAlrtAxeEvent } from "../shared/connectors/alrtAxeAdapter";
import { sdk } from "./_core/sdk";
import * as db from "./db";

function canonicalShadowFromLegacyAxe(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const envelope = payload as Record<string, unknown>;
  if (envelope.eventType !== "alert.received") return undefined;
  const data = envelope.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const alert = (data as Record<string, unknown>).alert;
  if (!alert || typeof alert !== "object" || Array.isArray(alert)) return undefined;
  const axeAlert = alert as Record<string, unknown>;

  const eventId = envelope.eventId;
  const occurredAt = envelope.occurredAt;
  const correlationId = envelope.correlationId;
  const idempotencyKey = envelope.idempotencyKey;
  const externalId = axeAlert.externalId;
  const category = axeAlert.category;
  const severity = axeAlert.priority;
  const description = axeAlert.description;
  const address = axeAlert.address;
  const latitude = axeAlert.latitude;
  const longitude = axeAlert.longitude;

  if (
    typeof eventId !== "string" ||
    typeof occurredAt !== "string" ||
    typeof correlationId !== "string" ||
    typeof idempotencyKey !== "string" ||
    typeof externalId !== "string" ||
    typeof category !== "string" ||
    typeof severity !== "string" ||
    typeof description !== "string" ||
    typeof address !== "string" ||
    typeof latitude !== "number" ||
    typeof longitude !== "number"
  ) {
    return undefined;
  }

  return {
    specversion: "1.0",
    id: eventId,
    source: "urn:axesistemas:motor-eventos:mock",
    type: "com.axesistemas.alerta.urbano.recebido.v1",
    subject: `alerta/${externalId}`,
    time: occurredAt,
    datacontenttype: "application/json",
    dataschema: "urn:axesistemas:schema:alerta:urbano:1.0.0",
    correlationid: correlationId,
    idempotencykey: idempotencyKey,
    axesrunid: `mock:${eventId}`,
    axesscenarioid: "shadow-alrt-axe",
    axesscenarioversion: "1.0.0",
    axesseed: externalId,
    axessequence: 1,
    axessimulated: true,
    data: {
      assetId: externalId,
      category,
      severity,
      description,
      location: { address, latitude, longitude },
    },
  };
}

function compareCanonicalShadow(canonicalEvent: unknown, legacyPayload: unknown) {
  try {
    return isDeepStrictEqual(toAlrtAxeEvent(canonicalEvent), legacyPayload);
  } catch {
    return false;
  }
}

export async function deliverToInternalMock(input: {
  userId: number;
  dispatchedAlertId: number;
  payloadJson: string;
  canonicalEvent?: unknown;
}) {
  await db.recordMockReceipt({
    userId: input.userId,
    dispatchedAlertId: input.dispatchedAlertId,
    payloadJson: input.payloadJson,
  });

  const legacyPayload: unknown = JSON.parse(input.payloadJson);
  const canonicalEvent = input.canonicalEvent ?? canonicalShadowFromLegacyAxe(legacyPayload);
  const compatibility = canonicalEvent
    ? {
        checked: true as const,
        equivalent: compareCanonicalShadow(canonicalEvent, legacyPayload),
      }
    : undefined;

  return {
    ok: true as const,
    status: 202,
    summary: "Recebido pelo endpoint mock interno.",
    attempts: 1,
    failureReason: undefined as string | undefined,
    ...(compatibility ? { compatibility } : {}),
  };
}

export async function mockDispatchHandler(req: Request, res: Response) {
  try {
    const authenticatedUser = await sdk.authenticateRequest(req);
    const body = req.body as Record<string, unknown> | undefined;
    const userId = Number(body?.simulationUserId);
    const dispatchedAlertId = Number(body?.dispatchedAlertId);
    const payload = body?.payload;
    if (!Number.isInteger(userId) || !Number.isInteger(dispatchedAlertId) || !payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Corpo mock inválido." });
    }
    if (authenticatedUser.id !== userId) {
      return res.status(403).json({ error: "O mock interno só aceita alertas do operador autenticado." });
    }
    const result = await deliverToInternalMock({
      userId,
      dispatchedAlertId,
      payloadJson: JSON.stringify(payload),
    });
    return res.status(202).json({ accepted: true, source: "mock-interno", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no mock interno.";
    return res.status(500).json({ error: message });
  }
}
