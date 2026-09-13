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
import { serveStatic, setupVite } from "./vite";
import { createRateLimiter, requireHttpsInProduction, requestKey, securityHeaders } from "./security";

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
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(requireHttpsInProduction);
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ limit: "256kb", extended: true }));
  const integrationRateLimit = createRateLimiter({
    windowMs: 60_000,
    max: 120,
    key: requestKey,
    message: "Limite de integração excedido. Tente novamente mais tarde.",
  });
  const streamRateLimit = createRateLimiter({
    windowMs: 60_000,
    max: 20,
    key: requestKey,
    message: "Limite de conexões SSE excedido.",
  });
  registerStorageProxy(app);
  app.get("/api/maps/static", staticMapHandler);
  app.post("/api/mock/dispatch", integrationRateLimit, mockDispatchHandler);
  registerWorkflowRoutes(app, undefined, integrationRateLimit);
  registerEventBusRoutes(app, undefined, streamRateLimit);
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

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
