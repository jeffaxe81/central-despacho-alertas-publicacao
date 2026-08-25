import { describe, expect, it, vi } from "vitest";
import { receiveWorkflowOccurrence } from "./workflowReceiver";

const validPayload = {
  schemaVersion: "1.0" as const,
  id: "EXT-000001",
  code: "URB-TRAFFIC_LIGHT-000001",
  priority: "HIGH" as const,
  status: "NEW",
  createdAt: "2026-08-22T12:30:00.000Z",
  eventType: "TRAFFIC_LIGHT",
  title: "Falha em semáforo",
  narrative: "Sinaleira apagada em uma ocorrência recebida pelo workflow.",
  location: {
    address: "Rua de Teste, nº 100",
    neighborhood: "Ambiente de Teste",
    latitude: -15.793889,
    longitude: -47.882778,
  },
  source: { system: "central-despacho-alertas", mode: "test", correlationId: "EXT-000001" },
};

function store(overrides: Partial<Record<"getAlertTypeByApiKey" | "getWorkflowOccurrenceByExternalId" | "createWorkflowOccurrence", ReturnType<typeof vi.fn>>> = {}) {
  return {
    getAlertTypeByApiKey: vi.fn().mockResolvedValue({ id: 9, userId: 4 }),
    getWorkflowOccurrenceByExternalId: vi.fn().mockResolvedValue(undefined),
    createWorkflowOccurrence: vi.fn().mockResolvedValue(91),
    createWorkflowProcessLog: vi.fn().mockResolvedValue(101),
    ...overrides,
  };
}

describe("workflow de recebimento de ocorrências", () => {
  it("rejeita uma chamada sem API key", async () => {
    const workflowStore = store();
    const result = await receiveWorkflowOccurrence(undefined, validPayload, workflowStore as any);
    expect(result).toEqual({ status: 401, body: { accepted: false, error: "API key ausente." } });
    expect(workflowStore.createWorkflowProcessLog).toHaveBeenCalledWith(expect.objectContaining({ outcome: "unauthorized", httpStatus: 401 }));
  });

  it("rejeita payload inválido depois de autenticar a API key", async () => {
    const result = await receiveWorkflowOccurrence("chave-valida", { ...validPayload, location: { ...validPayload.location, latitude: 100 } }, store() as any);
    expect(result.status).toBe(422);
    expect(result.body.accepted).toBe(false);
  });

  it("aceita, registra e retorna recibo para uma ocorrência válida", async () => {
    const workflowStore = store();
    const result = await receiveWorkflowOccurrence("chave-valida", validPayload, workflowStore as any);

    expect(result).toEqual({ status: 202, body: { accepted: true, duplicate: false, receiptId: 91 } });
    expect(workflowStore.createWorkflowOccurrence).toHaveBeenCalledWith(expect.objectContaining({
      userId: 4,
      alertTypeId: 9,
      externalId: "EXT-000001",
      latitude: -15.793889,
      longitude: -47.882778,
    }));
    expect(workflowStore.createWorkflowProcessLog).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "accepted",
      httpStatus: 202,
      externalId: "EXT-000001",
    }));
  });

  it("não duplica uma ocorrência com o mesmo id externo", async () => {
    const workflowStore = store({ getWorkflowOccurrenceByExternalId: vi.fn().mockResolvedValue({ id: 77 }) });
    const result = await receiveWorkflowOccurrence("chave-valida", validPayload, workflowStore as any);

    expect(result).toEqual({ status: 200, body: { accepted: true, duplicate: true, receiptId: 77 } });
    expect(workflowStore.createWorkflowOccurrence).not.toHaveBeenCalled();
    expect(workflowStore.createWorkflowProcessLog).toHaveBeenCalledWith(expect.objectContaining({ outcome: "duplicate", httpStatus: 200 }));
  });
});
