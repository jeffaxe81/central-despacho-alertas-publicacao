import express from "express";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerWorkflowRoutes } from "./workflowRoutes";

const validPayload = {
  schemaVersion: "1.0", id: "DISPATCH-100", code: "URB-TRAFFIC-100", priority: "HIGH", status: "NEW",
  createdAt: "2026-08-22T12:30:00.000Z", eventType: "TRAFFIC_LIGHT", title: "Falha de semáforo",
  narrative: "Semáforo apagado em ocorrência enviada pelo Dispatch App.",
  location: { address: "Rua de Teste, nº 100", neighborhood: "Bairro Teste", latitude: -15.793889, longitude: -47.882778 },
  source: { system: "dispatch-app", mode: "test", correlationId: "DISPATCH-100" },
};

function workflowStore() {
  let existing: { id: number } | undefined;
  return {
    getAlertTypeByApiKey: vi.fn().mockImplementation(async (key: string) => key === "api-key-integration" ? { id: 5, userId: 9 } : undefined),
    getWorkflowOccurrenceByExternalId: vi.fn().mockImplementation(async () => existing),
    createWorkflowOccurrence: vi.fn().mockImplementation(async () => { existing = { id: 42 }; return 42; }),
    createWorkflowProcessLog: vi.fn().mockResolvedValue(1),
  };
}

async function post(app: express.Express, payload: unknown, apiKey?: string) {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/integrations/occurrences`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) }, body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

describe("rota HTTP de integração de ocorrências", () => {
  const apps: express.Express[] = [];
  afterEach(() => { apps.splice(0); });

  it("registra a rota e responde 401, 422, 202 e 200 conforme o contrato", async () => {
    const app = express();
    app.use(express.json());
    const store = workflowStore();
    registerWorkflowRoutes(app, store as any);
    apps.push(app);

    await expect(post(app, validPayload)).resolves.toMatchObject({ status: 401, body: { accepted: false } });
    await expect(post(app, { ...validPayload, location: { ...validPayload.location, latitude: 91 } }, "api-key-integration")).resolves.toMatchObject({ status: 422, body: { accepted: false } });
    await expect(post(app, validPayload, "api-key-integration")).resolves.toMatchObject({ status: 202, body: { accepted: true, duplicate: false, receiptId: 42 } });
    await expect(post(app, validPayload, "api-key-integration")).resolves.toMatchObject({ status: 200, body: { accepted: true, duplicate: true, receiptId: 42 } });
  });
});
