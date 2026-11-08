import type { Express, Request, Response } from "express";
import * as db from "../db";
import { registerSseClient, unregisterSseClient } from "./sseBroadcaster";
import { logEvent } from "../observability/logger";

/**
 * A API key pode vir no header `Authorization: Bearer <key>` (recomendado).
 * O fallback por query string (`?api_key=`) só fica disponível quando
 * SSE_ALLOW_QUERY_API_KEY=true, porque o valor pode aparecer em logs de acesso,
 * histórico do navegador e cabeçalhos de proxies. Mantido apenas para clientes
 * que não conseguem enviar headers (EventSource nativo em navegador).
 */
export function queryApiKeyAllowed(): boolean {
  return process.env.SSE_ALLOW_QUERY_API_KEY === "true";
}

export function extractApiKey(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice("Bearer ".length).trim();
  if (!queryApiKeyAllowed()) return undefined;
  const queryKey = req.query.api_key;
  return typeof queryKey === "string" ? queryKey.trim() : undefined;
}

export function registerEventBusRoutes(app: Express, store: Pick<typeof db, "getSubscriptionBySubscriberApiKey"> = db) {
  app.get("/api/events/stream", async (req: Request, res: Response) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      const hint = queryApiKeyAllowed()
        ? "Use 'Authorization: Bearer <key>' ou '?api_key='."
        : "Use 'Authorization: Bearer <key>'.";
      res.status(401).json({ error: `API key ausente. ${hint}` });
      return;
    }

    const subscription = await store.getSubscriptionBySubscriberApiKey(apiKey);
    if (!subscription || subscription.deliveryMode !== "sse") {
      res.status(401).json({ error: "API key inválida ou assinatura não é do tipo SSE." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`: conectado à assinatura "${subscription.label}"\n\n`);

    const channel = String(subscription.id);
    registerSseClient(channel, res);
    logEvent("info", "eventbus.sse_connected", { subscriptionId: subscription.id, tenantId: subscription.tenantId });

    req.on("close", () => {
      unregisterSseClient(channel, res);
      logEvent("info", "eventbus.sse_disconnected", { subscriptionId: subscription.id, tenantId: subscription.tenantId });
    });
  });
}
