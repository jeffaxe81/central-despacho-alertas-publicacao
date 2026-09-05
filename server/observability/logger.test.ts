import { afterEach, describe, expect, it, vi } from "vitest";
import { logEvent } from "./logger";

describe("logEvent", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emite uma linha JSON estruturada com timestamp, level, event e os campos fornecidos", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logEvent("info", "dispatch.attempt", { correlationId: "corr-1", eventId: "evt-1", connectorId: "axe-dispatch" });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({ level: "info", event: "dispatch.attempt", correlationId: "corr-1", eventId: "evt-1", connectorId: "axe-dispatch" });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("usa console.warn para level 'warn' e console.error para level 'error'", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logEvent("warn", "dispatch.blocked_proposta", {});
    logEvent("error", "dispatch.exception", {});

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
