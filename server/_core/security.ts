import type { NextFunction, Request, Response } from "express";

/**
 * In-process guardrail. Em múltiplas réplicas, substituir por um store compartilhado
 * (Redis/API gateway), mantendo estes limites como fallback local.
 */
export function createRateLimiter(input: {
  windowMs: number;
  max: number;
  key: (request: Request) => string;
  message?: string;
}) {
  const buckets = new Map<string, { startedAt: number; count: number }>();

  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const key = input.key(request);
    const current = buckets.get(key);
    const bucket = !current || now - current.startedAt >= input.windowMs
      ? { startedAt: now, count: 0 }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > input.max) {
      const retryAfter = Math.ceil((input.windowMs - (now - bucket.startedAt)) / 1000);
      response.setHeader("Retry-After", String(Math.max(1, retryAfter)));
      response.status(429).json({ error: input.message ?? "Limite de requisições excedido." });
      return;
    }

    next();
  };
}

export function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

export function requestKey(request: Request) {
  const apiKey = request.header("x-api-key") ?? request.header("authorization");
  return apiKey ? `credential:${apiKey.slice(0, 96)}` : `ip:${request.ip}`;
}

export function requireHttpsInProduction(request: Request, response: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "production" && request.path.startsWith("/api/") && request.protocol !== "https") {
    response.status(400).json({ error: "HTTPS obrigatório." });
    return;
  }
  next();
}
