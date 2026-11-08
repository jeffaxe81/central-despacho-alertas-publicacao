import express from "express";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { registerHealthRoutes } from "./healthRoutes";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      server => new Promise<void>(resolve => server.close(() => resolve())),
    ),
  );
});

async function getProbe(path: string, checkReady: () => Promise<boolean>) {
  const app = express();
  registerHealthRoutes(app, checkReady);
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return fetch(`http://127.0.0.1:${address.port}${path}`);
}

describe("operational health probes", () => {
  it("reports liveness independently of the database", async () => {
    const response = await getProbe("/health/live", async () => false);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "axe-alertas" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports readiness on successful database check", async () => {
    const response = await getProbe("/health/ready", async () => true);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", service: "axe-alertas" });
  });

  it("fails closed when database is unavailable", async () => {
    const response = await getProbe("/health/ready", async () => false);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable", service: "axe-alertas" });
  });

  it("does not expose internal readiness exception details", async () => {
    const response = await getProbe("/health/ready", async () => {
      throw new Error("never-expose-secret-database-host");
    });
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).not.toContain("never-expose");
  });
});
