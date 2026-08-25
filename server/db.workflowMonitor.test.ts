import { describe, expect, it, vi } from "vitest";
import { queryWorkflowMonitor } from "./db";

function queryChain(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  return { from, where, orderBy, limit };
}

describe("queryWorkflowMonitor", () => {
  it("retorna ocorrências e logs com o mesmo limite e ordenação do monitoramento", async () => {
    const occurrences = [{ id: 8, receivedAt: new Date("2026-08-22T12:10:00Z") }];
    const logs = [{ id: 11, createdAt: new Date("2026-08-22T12:11:00Z"), outcome: "accepted" }];
    const occurrenceQuery = queryChain(occurrences);
    const logQuery = queryChain(logs);
    const database = { select: vi.fn().mockReturnValueOnce(occurrenceQuery).mockReturnValueOnce(logQuery) };

    const result = await queryWorkflowMonitor(database as any, 4, 25);

    expect(result).toEqual({ occurrences, logs });
    expect(occurrenceQuery.where).toHaveBeenCalledOnce();
    expect(occurrenceQuery.orderBy).toHaveBeenCalledOnce();
    expect(occurrenceQuery.limit).toHaveBeenCalledWith(25);
    expect(logQuery.where).toHaveBeenCalledOnce();
    expect(logQuery.orderBy).toHaveBeenCalledOnce();
    expect(logQuery.limit).toHaveBeenCalledWith(25);
  });
});
