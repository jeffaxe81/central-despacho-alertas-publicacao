export type OutboxDelivery = {
  id: number;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  subscription: {
    id: number;
    deliveryMode: "webhook" | "sse";
    endpointUrl?: string | null;
    headersJson?: string | null;
    outboundApiKey?: string | null;
    outboundApiKeyHeader?: string | null;
    subscriberApiKey?: string;
  };
};

export type DeliveryResult = {
  ok: boolean;
  status: number | null;
  failureReason?: string;
};

export type OutboxWorkerStore = {
  claimDueDeliveries(workerId: string, limit: number, leaseMs: number): Promise<OutboxDelivery[]>;
  markDelivered(deliveryId: number, status: number | null): Promise<void>;
  scheduleRetry(input: {
    deliveryId: number;
    attempts: number;
    nextAttemptAt: Date;
    status: number | null;
    error: string;
  }): Promise<void>;
  markDeadLetter(input: {
    deliveryId: number;
    attempts: number;
    status: number | null;
    error: string;
  }): Promise<void>;
};

export type OutboxDeliveryTransport = (
  delivery: OutboxDelivery
) => Promise<DeliveryResult>;

export function retryDelayMs(attempt: number, random = Math.random) {
  const exponent = Math.max(0, Math.min(attempt - 1, 8));
  const base = Math.min(60_000 * 2 ** exponent, 15 * 60_000);
  return base + Math.floor(random() * 5_000);
}

export function isRetryableDelivery(result: DeliveryResult) {
  return result.status === null || result.status === 408 || result.status === 429 || result.status >= 500;
}

export async function processDelivery(
  store: OutboxWorkerStore,
  delivery: OutboxDelivery,
  transport: OutboxDeliveryTransport,
  now = () => new Date()
) {
  try {
    const result = await transport(delivery);
    if (result.ok) {
      await store.markDelivered(delivery.id, result.status);
      return "delivered" as const;
    }

    const error = result.failureReason ?? `Entrega rejeitada com HTTP ${result.status ?? "desconhecido"}.`;
    const attempts = delivery.attempts + 1;
    if (!isRetryableDelivery(result) || attempts >= delivery.maxAttempts) {
      await store.markDeadLetter({ deliveryId: delivery.id, attempts, status: result.status, error });
      return "dead_letter" as const;
    }

    await store.scheduleRetry({
      deliveryId: delivery.id,
      attempts,
      nextAttemptAt: new Date(now().getTime() + retryDelayMs(attempts)),
      status: result.status,
      error,
    });
    return "retry" as const;
  } catch (error) {
    const attempts = delivery.attempts + 1;
    const message = error instanceof Error ? error.message : "Falha de transporte desconhecida.";
    if (attempts >= delivery.maxAttempts) {
      await store.markDeadLetter({ deliveryId: delivery.id, attempts, status: null, error: message });
      return "dead_letter" as const;
    }

    await store.scheduleRetry({
      deliveryId: delivery.id,
      attempts,
      nextAttemptAt: new Date(now().getTime() + retryDelayMs(attempts)),
      status: null,
      error: message,
    });
    return "retry" as const;
  }
}

export async function runOutboxWorker(input: {
  store: OutboxWorkerStore;
  transport: OutboxDeliveryTransport;
  workerId: string;
  signal?: AbortSignal;
  batchSize?: number;
  leaseMs?: number;
  idleMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}) {
  const batchSize = input.batchSize ?? 50;
  const leaseMs = input.leaseMs ?? 120_000;
  const idleMs = input.idleMs ?? 1_000;
  const sleep = input.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));

  while (!input.signal?.aborted) {
    const deliveries = await input.store.claimDueDeliveries(input.workerId, batchSize, leaseMs);
    if (deliveries.length === 0) {
      await sleep(idleMs);
      continue;
    }

    for (const delivery of deliveries) {
      if (input.signal?.aborted) break;
      await processDelivery(input.store, delivery, input.transport);
    }
  }
}
