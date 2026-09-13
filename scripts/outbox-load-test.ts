import { createPool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { createMysqlOutboxStore } from "../server/eventBus/mysqlOutboxStore";

const url = process.env.LOAD_TEST_URL ?? process.env.MYSQL_TEST_URL;
if (!url) throw new Error("Defina LOAD_TEST_URL ou MYSQL_TEST_URL.");

const TOTAL_EVENTS = Number(process.env.LOAD_TEST_EVENTS ?? 400);
const TENANTS = ["tenant-a", "tenant-b", "tenant-c", "tenant-d"];
const WORKERS = Number(process.env.LOAD_TEST_WORKERS ?? 8);
const BATCH_SIZE = Number(process.env.LOAD_TEST_BATCH ?? 25);

const pool = createPool(url);
const database = drizzle(pool as any);
const store = createMysqlOutboxStore(database);
const claimedIds = new Set<number>();
const claimLock = { value: false };
let totalClaimed = 0;
let totalDelivered = 0;

async function setup() {
  await pool.query("DROP TABLE IF EXISTS event_outbox_deliveries, event_subscriptions, event_outbox");
  await pool.query(`CREATE TABLE event_outbox (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    tenant_id VARCHAR(64) NOT NULL,
    correlation_id VARCHAR(160) NOT NULL,
    event_id VARCHAR(160) NOT NULL,
    category VARCHAR(64) NOT NULL,
    connector_id VARCHAR(64),
    payload_json TEXT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    delivered_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_until TIMESTAMP NULL,
    locked_by VARCHAR(128),
    last_error TEXT,
    delivered_at TIMESTAMP NULL,
    dead_lettered_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE event_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    tenant_id VARCHAR(64) NOT NULL,
    delivery_mode VARCHAR(16) NOT NULL,
    endpoint_url VARCHAR(2000),
    headers_json TEXT,
    outbound_api_key VARCHAR(4000),
    outbound_api_key_header VARCHAR(100),
    subscriber_api_key VARCHAR(128) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
  )`);
  await pool.query(`CREATE TABLE event_outbox_deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    outbox_id INT NOT NULL,
    subscription_id INT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_until TIMESTAMP NULL,
    locked_by VARCHAR(128),
    last_http_status INT NULL,
    last_error TEXT,
    delivered_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY event_outbox_delivery_unique (outbox_id, subscription_id)
  )`);

  for (let index = 0; index < TOTAL_EVENTS; index += 1) {
    const tenant = TENANTS[index % TENANTS.length];
    await pool.query(
      "INSERT INTO event_outbox (tenant_id, correlation_id, event_id, category, payload_json) VALUES (?, ?, ?, ?, ?)",
      [tenant, `load-corr-${index}`, `load-event-${index}`, "semaforos", JSON.stringify({ index, tenant })]
    );
    const [outboxRows] = await pool.query("SELECT LAST_INSERT_ID() AS id");
    const outboxId = Number((outboxRows as Array<{ id: number }>)[0].id);
    await pool.query(
      "INSERT INTO event_subscriptions (tenant_id, delivery_mode, endpoint_url, headers_json, subscriber_api_key) VALUES (?, 'webhook', 'https://load.test/hook', '{}', ?)",
      [tenant, `sub-load-${index}`]
    );
    const [subscriptionRows] = await pool.query("SELECT LAST_INSERT_ID() AS id");
    const subscriptionId = Number((subscriptionRows as Array<{ id: number }>)[0].id);
    await pool.query("INSERT INTO event_outbox_deliveries (outbox_id, subscription_id) VALUES (?, ?)", [outboxId, subscriptionId]);
  }
}

async function worker(workerId: string) {
  while (true) {
    const deliveries = await store.claimDueDeliveries(workerId, BATCH_SIZE, 30_000);
    if (deliveries.length === 0) return;
    for (const delivery of deliveries) {
      totalClaimed += 1;
      if (claimLock.value && claimedIds.has(delivery.id)) {
        throw new Error(`Duplicidade detectada para delivery ${delivery.id}`);
      }
      claimLock.value = true;
      claimedIds.add(delivery.id);
      claimLock.value = false;
      await store.markDelivered(delivery.id, 202);
      totalDelivered += 1;
    }
  }
}

await setup();
const startedAt = performance.now();
await Promise.all(Array.from({ length: WORKERS }, (_, index) => worker(`load-worker-${index}`)));
const elapsedMs = performance.now() - startedAt;
const [rows] = await pool.query("SELECT COUNT(*) AS total, SUM(status = 'delivered') AS delivered, COUNT(DISTINCT tenant_id) AS tenants FROM event_outbox o WHERE EXISTS (SELECT 1 FROM event_outbox_deliveries d WHERE d.outbox_id = o.id)");
const summary = (rows as Array<{ total: number; delivered: number; tenants: number }>)[0];
console.log(JSON.stringify({
  totalEvents: TOTAL_EVENTS,
  workers: WORKERS,
  batchSize: BATCH_SIZE,
  elapsedMs: Math.round(elapsedMs),
  claimed: totalClaimed,
  delivered: totalDelivered,
  uniqueClaimed: claimedIds.size,
  throughputPerSecond: Math.round((totalDelivered / elapsedMs) * 1000),
  database: summary,
}, null, 2));
await pool.query("DROP TABLE IF EXISTS event_outbox_deliveries, event_subscriptions, event_outbox");
await pool.end();
