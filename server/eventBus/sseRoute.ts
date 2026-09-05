import type { Express, Request, Response } from "express";
import * as db from "../db";
import { registerSseClient, unregisterSseClient } from "./sseBroadcaster";
import { logEvent } from "../observability/logger";

function extractApiKey(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice("Bearer ".length).trim();
  // Fallback via query string: necessário porque clientes SSE em navegador
  // (EventSource nativo) não conseguem definir headers customizados. Menos
  // seguro (pode vazar em logs de acesso) — documentado, não escondido.
  const queryKey = req.query.api_key;
  return typeof queryKey === "string" ? queryKey.trim() : undefined;
}

export function registerEventBusRoutes(app: Express, store: Pick<typeof db, "getSubscriptionBySubscriberApiKey"> = db) {
  app.get("/api/events/stream", async (req: Request, res: Response) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({ error: "API key ausente. Use 'Authorization: Bearer <key>' ou '?api_key='." });
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

    registerSseClient(subscription.subscriberApiKey, res);
    logEvent("info", "eventbus.sse_connected", { subscriptionId: subscription.id, tenantId: subscription.tenantId });

    req.on("close", () => {
      unregisterSseClient(subscription.subscriberApiKey, res);
      logEvent("info", "eventbus.sse_disconnected", { subscriptionId: subscription.id, tenantId: subscription.tenantId });
    });
  });
}
