import { createPool, type Pool } from "mysql2/promise";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createMysqlOutboxStore } from "./mysqlOutboxStore";

const connectionUrl = process.env.MYSQL_TEST_URL;
const describeMysql = describe.skipIf(!connectionUrl);
let pool: Pool;

const schema = [
  `CREATE TABLE event_outbox (id INT AUTO_INCREMENT PRIMARY KEY, payload_json TEXT NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'pending', delivered_count INT NOT NULL DEFAULT 0, failed_count INT NOT NULL DEFAULT 0, delivered_at TIMESTAMP NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
  `CREATE TABLE event_subscriptions (id INT AUTO_INCREMENT PRIMARY KEY, delivery_mode VARCHAR(16) NOT NULL, endpoint_url VARCHAR(2000), headers_json TEXT, outbound_api_key VARCHAR(4000), outbound_api_key_header VARCHAR(100), subscriber_api_key VARCHAR(128), is_active BOOLEAN NOT NULL DEFAULT TRUE)`,
  `CREATE TABLE event_outbox_deliveries (id INT AUTO_INCREMENT PRIMARY KEY, outbox_id INT NOT NULL, subscription_id INT NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0, next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, locked_until TIMESTAMP NULL, locked_by VARCHAR(128) NULL, last_http_status INT NULL, last_error TEXT NULL, delivered_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY event_outbox_delivery_unique (outbox_id, subscription_id))`,
];

describeMysql("MySQL Outbox concurrency", () => {
  beforeAll(async () => {
    pool = createPool(connectionUrl!);
    await pool.query("DROP TABLE IF EXISTS event_outbox_deliveries, event_subscriptions, event_outbox");
    for (const statement of schema) await pool.query(statement);
    await pool.query("INSERT INTO event_outbox (payload_json) VALUES (?)", [JSON.stringify({ eventId: "evt-real-1" })]);
    await pool.query("INSERT INTO event_subscriptions (delivery_mode, endpoint_url, headers_json) VALUES ('webhook', 'https://example.test/hook', '{}')");
    await pool.query("INSERT INTO event_outbox_deliveries (outbox_id, subscription_id) VALUES (1, 1)");
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DROP TABLE IF EXISTS event_outbox_deliveries, event_subscriptions, event_outbox");
    await pool.end();
  });

  it("reivindica uma entrega apenas uma vez com dois workers concorrentes", async () => {
    const database = (await import("drizzle-orm/mysql2")).drizzle(pool as any);
    const store = createMysqlOutboxStore(database);
    const [first, second] = await Promise.all([
      store.claimDueDeliveries("worker-a", 10, 120_000),
      store.claimDueDeliveries("worker-b", 10, 120_000),
    ]);

    expect(first.length + second.length).toBe(1);
    expect(new Set([...first, ...second].map(item => item.id)).size).toBe(1);
  });

  it("recupera entrega após expiração do lease", async () => {
    await pool.query("UPDATE event_outbox_deliveries SET locked_until = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 MINUTE), status = 'processing'");
    const database = (await import("drizzle-orm/mysql2")).drizzle(pool as any);
    const store = createMysqlOutboxStore(database);
    const recovered = await store.claimDueDeliveries("worker-recovery", 10, 120_000);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.id).toBe(1);
  });
});
