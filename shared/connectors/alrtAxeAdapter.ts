import { z } from "zod";
import { canonicalEventSchema } from "../events/canonicalEvent";

const axeAlertDataSchema = z.object({
  assetId: z.string().trim().min(1),
  category: z.string().trim().min(1),
  severity: z.enum(["baixa", "media", "alta", "critica"]),
  description: z.string().trim().min(1),
  location: z.object({
    address: z.string().trim().min(1),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
});

export interface AlrtAxeEvent {
  schemaVersion: "1.0";
  eventId: string;
  eventType: "alert.received";
  occurredAt: string;
  source: {
    system: "despacho-alrt";
    environment: "homologacao";
  };
  correlationId: string;
  idempotencyKey: string;
  data: {
    alert: {
      externalId: string;
      category: string;
      priority: "baixa" | "media" | "alta" | "critica";
      description: string;
      address: string;
      latitude: number;
      longitude: number;
      reportedAt: string;
      sourceStatus: "novo";
    };
  };
}

/**
 * Converte um evento sintético canônico no contrato ALRT -> AXE homologado.
 * Não envia, persiste ou altera a entrada recebida.
 */
export function toAlrtAxeEvent(input: unknown): AlrtAxeEvent {
  const event = canonicalEventSchema.parse(input);
  const alert = axeAlertDataSchema.parse(event.data);

  return {
    schemaVersion: "1.0",
    eventId: event.id,
    eventType: "alert.received",
    occurredAt: event.time,
    source: {
      system: "despacho-alrt",
      environment: "homologacao",
    },
    correlationId: event.correlationid,
    idempotencyKey: event.idempotencykey,
    data: {
      alert: {
        externalId: alert.assetId,
        category: alert.category,
        priority: alert.severity,
        description: alert.description,
        address: alert.location.address,
        latitude: alert.location.latitude,
        longitude: alert.location.longitude,
        reportedAt: event.time,
        sourceStatus: "novo",
      },
    },
  };
}
