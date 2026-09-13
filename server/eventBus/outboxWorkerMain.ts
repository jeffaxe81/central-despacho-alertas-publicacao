import "dotenv/config";
import os from "node:os";
import { postWithRetry, parseHeaders } from "../alertEngine";
import { broadcastToSse } from "./sseBroadcaster";
import { createMysqlOutboxStore } from "./mysqlOutboxStore";
import { runOutboxWorker, type OutboxDelivery } from "./outboxWorker";

async function transport(delivery: OutboxDelivery) {
  if (delivery.subscription.deliveryMode === "sse") {
    const delivered = broadcastToSse(delivery.subscription.subscriberApiKey ?? "", delivery.payload);
    return delivered > 0
      ? { ok: true, status: 200 }
      : { ok: false, status: 503, failureReason: "Nenhum cliente SSE conectado." };
  }

  if (!delivery.subscription.endpointUrl) {
    return { ok: false, status: 400, failureReason: "Assinatura webhook sem endpoint." };
  }

  return postWithRetry({
    endpointUrl: delivery.subscription.endpointUrl,
    headers: parseHeaders(delivery.subscription.headersJson ?? "{}"),
    apiKey: delivery.subscription.outboundApiKey,
    apiKeyHeader: delivery.subscription.outboundApiKeyHeader ?? undefined,
    payload: delivery.payload,
  });
}

const controller = new AbortController();
process.once("SIGTERM", () => controller.abort());
process.once("SIGINT", () => controller.abort());

runOutboxWorker({
  store: createMysqlOutboxStore(),
  transport,
  workerId: `${os.hostname()}-outbox-${process.pid}`,
  signal: controller.signal,
}).catch(error => {
  console.error("[OutboxWorker] fatal error", error);
  process.exitCode = 1;
});
