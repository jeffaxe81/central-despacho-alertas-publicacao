import type { Express } from "express";
import { createWorkflowOccurrenceHandler } from "./workflowReceiver";
import * as db from "./db";

export function registerWorkflowRoutes(app: Express, store: Parameters<typeof createWorkflowOccurrenceHandler>[0] = db) {
  app.post("/api/integrations/occurrences", createWorkflowOccurrenceHandler(store));
}
