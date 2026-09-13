import { sql } from "drizzle-orm";
import { eventOutbox, eventOutboxDeliveries, eventSubscriptions } from "../../drizzle/schema";
import { getDb } from "../db";
import type { OutboxDelivery, OutboxWorkerStore } from "./outboxWorker";

type Row = Record<string, unknown>;

function resultRows(result: unknown): Row[] {
  if (!Array.isArray(result)) return [];
  const rows = Array.isArray(result[0]) && Array.isArray(result[1]) ? result[0] : result;
  return rows as unknown as Row[];
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function intervalMicros(milliseconds: number) {
  return Math.max(1_000, Math.min(Math.floor(milliseconds * 1_000), 900_000_000));
}

function toDelivery(row: Row): OutboxDelivery {
  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(stringValue(row.payload_json, "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
  } catch {
    payload = {};
  }

  return {
    id: numberValue(row.delivery_id),
    attempts: numberValue(row.delivery_attempts),
    maxAttempts: 8,
    payload,
    subscription: {
      id: numberValue(row.subscription_id),
      deliveryMode: stringValue(row.delivery_mode) as "webhook" | "sse",
      endpointUrl: optionalString(row.endpoint_url),
      headersJson: optionalString(row.headers_json),
      outboundApiKey: optionalString(row.outbound_api_key),
      outboundApiKeyHeader: optionalString(row.outbound_api_key_header),
      subscriberApiKey: optionalString(row.subscriber_api_key) ?? undefined,
    },
  };
}

export function createMysqlOutboxStore(databaseOverride?: any): OutboxWorkerStore {
  return {
    async claimDueDeliveries(workerId, limit, leaseMs) {
      const database = databaseOverride ?? await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");
      const safeLimit = Math.max(1, Math.min(Math.floor(limit), 500));
      const lease = intervalMicros(leaseMs);

      return database.transaction(async (tx: any) => {
        const result = await tx.execute(sql`
          SELECT
            d.id AS delivery_id,
            d.attempts AS delivery_attempts,
            o.payload_json,
            s.id AS subscription_id,
            s.delivery_mode,
            s.endpoint_url,
            s.headers_json,
            s.outbound_api_key,
            s.outbound_api_key_header,
            s.subscriber_api_key
          FROM ${eventOutboxDeliveries} d
          INNER JOIN ${eventOutbox} o ON o.id = d.outbox_id
          INNER JOIN ${eventSubscriptions} s ON s.id = d.subscription_id
          WHERE d.status IN ('pending', 'retry', 'processing')
            AND d.next_attempt_at <= CURRENT_TIMESTAMP
            AND (d.locked_until IS NULL OR d.locked_until < CURRENT_TIMESTAMP)
            AND s.is_active = 1
          ORDER BY d.created_at ASC
          LIMIT ${safeLimit}
          FOR UPDATE SKIP LOCKED
        `);
        const rows = resultRows(result);
        const deliveries = rows.map(toDelivery);
        if (deliveries.length === 0) return deliveries;

        const ids = deliveries.map(delivery => delivery.id);
        await tx.execute(sql`
          UPDATE ${eventOutboxDeliveries}
          SET status = 'processing',
              locked_by = ${workerId},
              locked_until = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${lease} MICROSECOND),
              attempts = attempts + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
        `);
        return deliveries.map(delivery => ({ ...delivery, attempts: delivery.attempts + 1 }));
      });
    },

    async markDelivered(deliveryId, status) {
      const database = databaseOverride ?? await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");
      await database.transaction(async (tx: any) => {
        await tx.execute(sql`
          UPDATE ${eventOutboxDeliveries}
          SET status = 'delivered',
              last_http_status = ${status},
              delivered_at = CURRENT_TIMESTAMP,
              locked_until = NULL,
              locked_by = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${deliveryId}
        `);
        await refreshOutboxAggregate(tx, deliveryId);
      });
    },

    async scheduleRetry(input) {
      const database = databaseOverride ?? await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");
      await database.execute(sql`
        UPDATE ${eventOutboxDeliveries}
        SET status = 'retry',
            attempts = ${input.attempts},
            next_attempt_at = ${input.nextAttemptAt},
            last_http_status = ${input.status},
            last_error = ${input.error.slice(0, 2000)},
            locked_until = NULL,
            locked_by = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${input.deliveryId}
      `);
    },

    async markDeadLetter(input) {
      const database = databaseOverride ?? await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");
      await database.transaction(async (tx: any) => {
        await tx.execute(sql`
          UPDATE ${eventOutboxDeliveries}
          SET status = 'dead_letter',
              attempts = ${input.attempts},
              last_http_status = ${input.status},
              last_error = ${input.error.slice(0, 2000)},
              locked_until = NULL,
              locked_by = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${input.deliveryId}
        `);
        await refreshOutboxAggregate(tx, input.deliveryId);
      });
    },
  };
}

async function refreshOutboxAggregate(tx: any, deliveryId: number) {
  const rows = await tx.execute(sql`
    SELECT
      d.outbox_id,
      SUM(d.status = 'delivered') AS delivered_count,
      SUM(d.status = 'dead_letter') AS failed_count,
      SUM(d.status IN ('pending', 'processing', 'retry')) AS pending_count
    FROM ${eventOutboxDeliveries} d
    WHERE d.outbox_id = (SELECT outbox_id FROM ${eventOutboxDeliveries} WHERE id = ${deliveryId})
    GROUP BY d.outbox_id
  `);
  const row = resultRows(rows)[0] as Row | undefined;
  if (!row) return;
  const pending = numberValue(row.pending_count);
  const delivered = numberValue(row.delivered_count);
  const failed = numberValue(row.failed_count);
  const status = pending > 0 ? "pending" : failed > 0 ? "partial" : "delivered";
  await tx.execute(sql`
    UPDATE ${eventOutbox}
    SET status = ${status},
        delivered_count = ${delivered},
        failed_count = ${failed},
        delivered_at = ${status === "delivered" ? new Date() : null},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${row.outbox_id}
  `);
}
