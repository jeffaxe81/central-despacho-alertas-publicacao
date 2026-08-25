import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";

export async function deliverToInternalMock(input: {
  userId: number;
  dispatchedAlertId: number;
  payloadJson: string;
}) {
  await db.recordMockReceipt(input);
  return {
    ok: true as const,
    status: 202,
    summary: "Recebido pelo endpoint mock interno.",
    attempts: 1,
    failureReason: undefined as string | undefined,
  };
}

export async function mockDispatchHandler(req: Request, res: Response) {
  try {
    const authenticatedUser = await sdk.authenticateRequest(req);
    const body = req.body as Record<string, unknown> | undefined;
    const userId = Number(body?.simulationUserId);
    const dispatchedAlertId = Number(body?.dispatchedAlertId);
    const payload = body?.payload;
    if (!Number.isInteger(userId) || !Number.isInteger(dispatchedAlertId) || !payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Corpo mock inválido." });
    }
    if (authenticatedUser.id !== userId) {
      return res.status(403).json({ error: "O mock interno só aceita alertas do operador autenticado." });
    }
    const result = await deliverToInternalMock({
      userId,
      dispatchedAlertId,
      payloadJson: JSON.stringify(payload),
    });
    return res.status(202).json({ accepted: true, source: "mock-interno", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no mock interno.";
    return res.status(500).json({ error: message });
  }
}
