import type { Express } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

/**
 * Safe operational probes. They expose no environment variables, database
 * credentials, internal exception messages, tenant IDs or integration keys.
 */
export function registerHealthRoutes(
  app: Express,
  checkReady: () => Promise<boolean> = async () => {
    const db = await getDb();
    if (!db) return false;
    await db.execute(sql`SELECT 1`);
    return true;
  },
): void {
  app.get("/health/live", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ status: "ok", service: "axe-alertas" });
  });

  app.get("/health/ready", async (_req, res) => {
    let ready = false;
    try {
      ready = await checkReady();
    } catch {
      // Failure detail is intentionally not exposed by a public probe.
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "unavailable",
      service: "axe-alertas",
    });
  });
}
