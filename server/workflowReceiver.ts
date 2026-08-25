import type { Request, Response } from "express";
import { z } from "zod";
import * as db from "./db";

export const workflowOccurrenceSchema = z.object({
  schemaVersion: z.literal("1.0"),
  id: z.string().trim().min(3).max(160),
  code: z.string().trim().min(3).max(180),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.string().trim().min(1).max(48),
  createdAt: z.string().datetime(),
  eventType: z.string().trim().min(2).max(100),
  title: z.string().trim().min(3).max(240),
  narrative: z.string().trim().min(8).max(8000),
  location: z.object({
    address: z.string().trim().min(3).max(320),
    neighborhood: z.string().trim().min(2).max(160),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  source: z.object({
    system: z.string().trim().min(2).max(120),
    mode: z.string().trim().min(2).max(40),
    correlationId: z.string().trim().min(3).max(160),
  }).optional(),
});

export type WorkflowOccurrence = z.infer<typeof workflowOccurrenceSchema>;

type WorkflowStore = Pick<typeof db, "getAlertTypeByApiKey" | "getWorkflowOccurrenceByExternalId" | "createWorkflowOccurrence" | "createWorkflowProcessLog">;

function externalIdFrom(rawPayload: unknown) {
  return rawPayload && typeof rawPayload === "object" && "id" in rawPayload && typeof (rawPayload as { id?: unknown }).id === "string"
    ? (rawPayload as { id: string }).id.slice(0, 160)
    : null;
}

export async function receiveWorkflowOccurrence(apiKey: string | undefined, rawPayload: unknown, store: WorkflowStore = db) {
  if (!apiKey?.trim()) {
    await store.createWorkflowProcessLog({ externalId: externalIdFrom(rawPayload), outcome: "unauthorized", httpStatus: 401, reason: "API key ausente.", payloadJson: JSON.stringify(rawPayload) });
    return { status: 401 as const, body: { accepted: false, error: "API key ausente." } };
  }
  const alertType = await store.getAlertTypeByApiKey(apiKey.trim());
  if (!alertType) {
    await store.createWorkflowProcessLog({ externalId: externalIdFrom(rawPayload), outcome: "unauthorized", httpStatus: 401, reason: "API key inválida.", payloadJson: JSON.stringify(rawPayload) });
    return { status: 401 as const, body: { accepted: false, error: "API key inválida." } };
  }

  const parsed = workflowOccurrenceSchema.safeParse(rawPayload);
  if (!parsed.success) {
    await store.createWorkflowProcessLog({ userId: alertType.userId, alertTypeId: alertType.id, externalId: externalIdFrom(rawPayload), outcome: "invalid", httpStatus: 422, reason: "Payload inválido.", payloadJson: JSON.stringify(rawPayload) });
    return { status: 422 as const, body: { accepted: false, error: "Payload inválido.", details: parsed.error.flatten() } };
  }

  const payload = parsed.data;
  const existing = await store.getWorkflowOccurrenceByExternalId(alertType.id, payload.id);
  if (existing) {
    await store.createWorkflowProcessLog({ userId: alertType.userId, alertTypeId: alertType.id, externalId: payload.id, outcome: "duplicate", httpStatus: 200, reason: "Ocorrência já recebida.", payloadJson: JSON.stringify(rawPayload) });
    return { status: 200 as const, body: { accepted: true, duplicate: true, receiptId: existing.id } };
  }

  const receiptId = await store.createWorkflowOccurrence({
    userId: alertType.userId,
    alertTypeId: alertType.id,
    externalId: payload.id,
    code: payload.code,
    priority: payload.priority,
    status: payload.status,
    eventType: payload.eventType,
    title: payload.title,
    narrative: payload.narrative,
    address: payload.location.address,
    neighborhood: payload.location.neighborhood,
    latitude: payload.location.latitude,
    longitude: payload.location.longitude,
    payloadJson: JSON.stringify(rawPayload),
  });
  await store.createWorkflowProcessLog({ userId: alertType.userId, alertTypeId: alertType.id, externalId: payload.id, outcome: "accepted", httpStatus: 202, payloadJson: JSON.stringify(rawPayload) });
  return { status: 202 as const, body: { accepted: true, duplicate: false, receiptId } };
}

export function createWorkflowOccurrenceHandler(store: WorkflowStore = db) {
  return async (request: Request, response: Response) => {
    const result = await receiveWorkflowOccurrence(request.header("x-api-key") ?? undefined, request.body, store);
    return response.status(result.status).json(result.body);
  };
}

export const workflowOccurrenceHandler = createWorkflowOccurrenceHandler();
