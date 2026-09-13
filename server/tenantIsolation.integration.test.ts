import express from "express";
import { createServer } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { registerWorkflowRoutes } from "./workflowRoutes";

const payload = (id: string) => ({
  schemaVersion: "1.0", id, code: `URB-${id}`, priority: "HIGH", status: "NEW",
  createdAt: "2026-08-22T12:30:00.000Z", eventType: "TRAFFIC_LIGHT", title: "Falha de semáforo",
  narrative: "Semáforo apagado em ocorrência enviada pelo Dispatch App.",
  location: { address: "Rua de Teste, nº 100", neighborhood: "Bairro Teste", latitude: -15.793889, longitude: -47.882778 },
});

async function post(app: express.Express, key: string, body: unknown) {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/integrations/occurrences`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

describe("isolamento multi-tenant na API de workflow", () => {
  it("credenciais de tenants diferentes persistem apenas no próprio escopo", async () => {
    const occurrences: Array<{ tenantId: string; externalId: string }> = [];
    const logs: Array<{ tenantId: string; outcome: string }> = [];
    const store = {
      authenticateInboundCredential: vi.fn().mockImplementation(async (key: string) => {
        if (key === "in_tenant_a.secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") return { alertType: { id: 1, userId: 10, tenantId: "tenant-a" } };
        if (key === "in_tenant_b.secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb") return { alertType: { id: 2, userId: 20, tenantId: "tenant-b" } };
        return undefined;
      }),
      getAlertTypeByApiKey: vi.fn().mockResolvedValue(undefined),
      getWorkflowOccurrenceByExternalId: vi.fn().mockResolvedValue(undefined),
      createWorkflowOccurrence: vi.fn().mockImplementation(async (input: { userId: number; externalId: string }) => {
        occurrences.push({ tenantId: input.userId === 10 ? "tenant-a" : "tenant-b", externalId: input.externalId });
        return occurrences.length;
      }),
      createWorkflowProcessLog: vi.fn().mockImplementation(async (input: { userId?: number; outcome: string }) => {
        if (input.userId) logs.push({ tenantId: input.userId === 10 ? "tenant-a" : "tenant-b", outcome: input.outcome });
        return logs.length;
      }),
    };
    const app = express();
    app.use(express.json());
    registerWorkflowRoutes(app, store as any);

    await expect(post(app, "in_tenant_a.secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", payload("A-1"))).resolves.toMatchObject({ status: 202 });
    await expect(post(app, "in_tenant_b.secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", payload("B-1"))).resolves.toMatchObject({ status: 202 });
    await expect(post(app, "in_tenant_c.secret-cccccccccccccccccccccccccccccccc", payload("C-1"))).resolves.toMatchObject({ status: 401 });

    expect(occurrences).toEqual([
      { tenantId: "tenant-a", externalId: "A-1" },
      { tenantId: "tenant-b", externalId: "B-1" },
    ]);
    expect(occurrences.some(item => item.tenantId === "tenant-a" && item.externalId === "B-1")).toBe(false);
    expect(occurrences.some(item => item.tenantId === "tenant-b" && item.externalId === "A-1")).toBe(false);
  });
});
