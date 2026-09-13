import type { Express, RequestHandler } from "express";
import { createWorkflowOccurrenceHandler } from "./workflowReceiver";
import * as db from "./db";

export function registerWorkflowRoutes(
  app: Express,
  store: Parameters<typeof createWorkflowOccurrenceHandler>[0] = db,
  middleware?: RequestHandler
) {
  app.post("/api/integrations/occurrences", ...(middleware ? [middleware] : []), createWorkflowOccurrenceHandler(store));
}
