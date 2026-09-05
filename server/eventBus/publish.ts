import * as db from "../db";
import { postWithRetry } from "../alertEngine";
import { logEvent } from "../observability/logger";
import { broadcastToSse } from "./sseBroadcaster";

export interface PublishableEvent {
  userId: number;
  tenantId: string;
  correlationId: string;
  eventId: string;
  category: string;
  connectorId?: string;
  payload: Record<string, unknown>;
}

/**
 * Publica um evento no barramento (ADR-0001): grava a durabilidade (Opção 3,
 * outbox — sempre, independente de haver assinantes) e faz fan-out para toda
 * assinatura ativa daquele tenant/categoria, via webhook (Opção 1,
 * reaproveitando o transporte já homologado — retry, HMAC opcional, headers)
 * ou via SSE (push imediato aos clientes conectados no momento).
 *
 * Nunca lança para o chamador: uma falha aqui não pode derrubar o despacho
 * principal do Motor de Eventos (Seção 8 — o Motor publica; o que acontece
 * com os consumidores é responsabilidade deles, não do Motor).
 */
export async function publishEvent(event: PublishableEvent): Promise<void> {
  let outboxId: number | null = null;
  try {
    outboxId = await db.recordOutboxEvent({
      userId: event.userId,
      tenantId: event.tenantId,
      correlationId: event.correlationId,
      eventId: event.eventId,
      category: event.category,
      connectorId: event.connectorId ?? null,
      payloadJson: JSON.stringify(event.payload),
    });
  } catch (error) {
    logEvent("error", "eventbus.outbox_write_failed", {
      correlationId: event.correlationId,
      eventId: event.eventId,
      category: event.category,
      reason: error instanceof Error ? error.message : "Erro desconhecido.",
    });
    return;
  }

  let subscriptions: Awaited<ReturnType<typeof db.listActiveSubscriptionsForEvent>> = [];
  try {
    subscriptions = await db.listActiveSubscriptionsForEvent(event.tenantId, event.category);
  } catch (error) {
    logEvent("error", "eventbus.subscription_lookup_failed", {
      correlationId: event.correlationId,
      eventId: event.eventId,
      reason: error instanceof Error ? error.message : "Erro desconhecido.",
    });
    return;
  }

  if (subscriptions.length === 0) {
    await db.updateOutboxDelivery(outboxId, { status: "no_subscribers", deliveredCount: 0, failedCount: 0 });
    return;
  }

  let delivered = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    if (subscription.deliveryMode === "sse") {
      const reached = broadcastToSse(subscription.subscriberApiKey, event.payload);
      if (reached > 0) delivered += 1;
      logEvent(reached > 0 ? "info" : "warn", "eventbus.sse_broadcast", {
        correlationId: event.correlationId,
        eventId: event.eventId,
        subscriptionId: subscription.id,
        connectedClients: reached,
      });
      continue;
    }

    if (subscription.deliveryMode === "webhook" && subscription.endpointUrl) {
      try {
        const result = await postWithRetry({
          endpointUrl: subscription.endpointUrl,
          headers: JSON.parse(subscription.headersJson || "{}"),
          apiKey: subscription.outboundApiKey,
          apiKeyHeader: subscription.outboundApiKeyHeader ?? undefined,
          payload: event.payload,
        });
        if (result.ok) delivered += 1;
        else failed += 1;
        logEvent(result.ok ? "info" : "warn", "eventbus.webhook_delivery", {
          correlationId: event.correlationId,
          eventId: event.eventId,
          subscriptionId: subscription.id,
          httpStatus: result.status,
          attempt: result.attempts,
        });
      } catch (error) {
        failed += 1;
        logEvent("error", "eventbus.webhook_delivery_exception", {
          correlationId: event.correlationId,
          eventId: event.eventId,
          subscriptionId: subscription.id,
          reason: error instanceof Error ? error.message : "Erro desconhecido.",
        });
      }
    }
  }

  await db.updateOutboxDelivery(outboxId, {
    status: delivered === 0 ? "failed" : delivered < subscriptions.length ? "partial" : "delivered",
    deliveredCount: delivered,
    failedCount: failed,
  });
}
