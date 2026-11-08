import type { NextFunction, Request, Response } from "express";

/**
 * Limitador de requisições em janela fixa, em memória, por chave (normalmente o IP).
 *
 * LIMITAÇÃO DECLARADA: o contador vive em cada processo. Com várias instâncias
 * atrás de um balanceador, o limite efetivo é multiplicado pelo número de
 * instâncias. Um contador compartilhado (Redis) é o próximo passo se isso virar problema.
 */

export interface RateLimitOptions {
  name: string;
  windowMs: number;
  max: number;
  keyOf?: (req: Request) => string;
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Registra uma tentativa e informa se ela está dentro do limite. */
  hit(key: string): { allowed: boolean; retryAfterSeconds: number; remaining: number };
  /** Apenas para testes e diagnóstico. */
  size(): number;
  middleware(): (req: Request, res: Response, next: NextFunction) => void;
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const now = options.now ?? Date.now;
  let lastSweep = now();

  function sweep(current: number) {
    if (current - lastSweep < options.windowMs) return;
    lastSweep = current;
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= current) buckets.delete(key);
    });
  }

  function hit(key: string) {
    const current = now();
    sweep(current);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const allowed = bucket.count <= options.max;
    return {
      allowed,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)),
      remaining: Math.max(0, options.max - bucket.count),
    };
  }

  return {
    hit,
    size: () => buckets.size,
    middleware() {
      return (req, res, next) => {
        const result = hit(options.keyOf ? options.keyOf(req) : req.ip ?? "unknown");
        if (result.allowed) return next();
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
        res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes.", limiter: options.name });
      };
    },
  };
}

function readLimit(envName: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[envName] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Login e cadastro: protege contra força bruta de senha. */
export const authRateLimiter = () =>
  createRateLimiter({
    name: "auth",
    windowMs: 15 * 60 * 1000,
    max: readLimit("RATE_LIMIT_AUTH_MAX", 10),
  });

/** Recebimento de ocorrências por API key. */
export const ingestRateLimiter = () =>
  createRateLimiter({
    name: "ingest",
    windowMs: 60 * 1000,
    max: readLimit("RATE_LIMIT_INGEST_MAX", 120),
  });

/** Abertura de streams SSE (conexões de longa duração contam apenas na abertura). */
export const sseRateLimiter = () =>
  createRateLimiter({
    name: "sse",
    windowMs: 60 * 1000,
    max: readLimit("RATE_LIMIT_SSE_MAX", 30),
  });
