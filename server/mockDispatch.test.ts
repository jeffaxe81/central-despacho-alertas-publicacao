import { describe, expect, it, vi } from "vitest";

const recordMockReceipt = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({ recordMockReceipt }));

import { deliverToInternalMock } from "./mockDispatch";

describe("endpoint mock interno", () => {
  it("persiste o recebimento e retorna aceitação para a simulação", async () => {
    recordMockReceipt.mockResolvedValue(undefined);

    await expect(
      deliverToInternalMock({ userId: 12, dispatchedAlertId: 45, payloadJson: '{"categoria":"cameras"}' })
    ).resolves.toMatchObject({ ok: true, status: 202, attempts: 1 });

    expect(recordMockReceipt).toHaveBeenCalledWith({
      userId: 12,
      dispatchedAlertId: 45,
      payloadJson: '{"categoria":"cameras"}',
    });
  });
});
