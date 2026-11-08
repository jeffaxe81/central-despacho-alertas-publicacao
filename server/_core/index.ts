import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { mockDispatchHandler } from "../mockDispatch";
import { scheduledAlertDispatchHandler } from "../scheduledAlerts";
import { staticMapHandler } from "../staticMap";
import { registerWorkflowRoutes } from "../workflowRoutes";
import { registerEventBusRoutes } from "../eventBus/sseRoute";
import { pruneEventOutbox, backfillSecrets } from "../db";
import { startOutboxRetention } from "../eventBus/retention";
import { authRateLimiter, ingestRateLimiter, sseRateLimiter } from "./rateLimit";
import { getMasterKey } from "./secrets";
import { serveStatic, setupVite } from "./vite";
import { registerHealthRoutes } from "./healthRoutes";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Falha cedo: em produção, sem SECRETS_ENCRYPTION_KEY o servidor não sobe.
  getMasterKey();
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set("trust proxy", Number.isFinite(hops) ? hops : process.env.TRUST_PROXY);
  }

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Limites de requisição: força bruta de login, ingestão por API key e abertura de SSE.
  const authLimit = authRateLimiter().middleware();
  app.use("/api/trpc", (req, res, next) => (/auth\.(login|register)/.test(req.path) ? authLimit(req, res, next) : next()));
  app.use("/api/integrations/occurrences", ingestRateLimiter().middleware());
  app.use("/api/events/stream", sseRateLimiter().middleware());
  // Public, low-information probes for independently managed deployment.
  registerHealthRoutes(app);
  registerStorageProxy(app);
  app.get("/api/maps/static", staticMapHandler);
  app.post("/api/mock/dispatch", mockDispatchHandler);
  registerWorkflowRoutes(app);
  registerEventBusRoutes(app);
  app.post("/api/scheduled/dispatch-alert", scheduledAlertDispatchHandler);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  // Protege segredos gravados em texto puro por versões anteriores (idempotente).
  const migrated = await backfillSecrets();
  if (migrated.alertTypes > 0 || migrated.subscriptions > 0) {
    console.log(`[secrets] backfill concluído: ${migrated.alertTypes} tipo(s) de alerta, ${migrated.subscriptions} assinatura(s).`);
  }
  startOutboxRetention(pruneEventOutbox);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
