import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

function clock(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

describe("limitador de requisições", () => {
  it("permite até o máximo e bloqueia a partir daí na mesma janela", () => {
    const c = clock();
    const limiter = createRateLimiter({ name: "t", windowMs: 60_000, max: 3, now: c.now });
    expect(limiter.hit("ip").allowed).toBe(true);
    expect(limiter.hit("ip").allowed).toBe(true);
    expect(limiter.hit("ip").allowed).toBe(true);
    const blocked = limiter.hit("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reabre o limite quando a janela termina", () => {
    const c = clock();
    const limiter = createRateLimiter({ name: "t", windowMs: 60_000, max: 1, now: c.now });
    expect(limiter.hit("ip").allowed).toBe(true);
    expect(limiter.hit("ip").allowed).toBe(false);
    c.advance(60_000);
    expect(limiter.hit("ip").allowed).toBe(true);
  });

  it("conta chaves independentes separadamente", () => {
    const c = clock();
    const limiter = createRateLimiter({ name: "t", windowMs: 60_000, max: 1, now: c.now });
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("b").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(false);
  });

  it("middleware responde 429 com Retry-After e não chama next", () => {
    const c = clock();
    const limiter = createRateLimiter({ name: "t", windowMs: 60_000, max: 1, now: c.now, keyOf: () => "fixo" });
    const handler = limiter.middleware();
    const headers: Record<string, string> = {};
    let status = 0;
    let body: unknown;
    const res = {
      setHeader: (k: string, v: string) => { headers[k] = v; },
      status(code: number) { status = code; return this; },
      json(payload: unknown) { body = payload; return this; },
    } as any;
    let calls = 0;
    const next = () => { calls += 1; };

    handler({ ip: "1.1.1.1" } as any, res, next);
    expect(calls).toBe(1);

    handler({ ip: "1.1.1.1" } as any, res, next);
    expect(calls).toBe(1);
    expect(status).toBe(429);
    expect(headers["Retry-After"]).toMatch(/^\d+$/);
    expect(body).toMatchObject({ limiter: "t" });
  });
});
