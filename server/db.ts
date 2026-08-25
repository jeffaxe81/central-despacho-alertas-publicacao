import { and, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import {
  alertTypes,
  dispatchedAlerts,
  generalSettings,
  InsertUser,
  mockReceipts,
  NewAlertType,
  receivedWorkflowOccurrences,
  users,
  workflowProcessLogs,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import {
  DEFAULT_EVENT_SETTINGS,
  DEFAULT_PAYLOAD_TEMPLATE,
  DEFAULT_SIMULATION_COORDINATES,
  EVENT_CATEGORIES,
  type DeliveryStatus,
  type EventCategory,
  type Severity,
} from "../shared/alertSimulation";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createPasswordUser(input: { name: string; email: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const openId = `local_${randomUUID().replaceAll("-", "")}`;
  const result = await db.insert(users).values({
    openId,
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    loginMethod: "password",
    role: "user",
    lastSignedIn: new Date(),
  });

  const created = await db.select().from(users).where(eq(users.id, Number(result[0].insertId))).limit(1);
  if (!created[0]) throw new Error("Não foi possível criar a conta.");
  return created[0];
}

export async function recordPasswordLogin(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function ensureDefaultAlertTypes(userId: number) {
  const db = await getDb();
  if (!db) return [];

  for (const category of EVENT_CATEGORIES) {
    const defaults = DEFAULT_EVENT_SETTINGS[category.key];
    const values: NewAlertType = {
      userId,
      category: category.key,
      name: category.label,
      defaultDescription: defaults.description,
      defaultSeverity: defaults.severity,
      endpointUrl: "mock://central-despacho",
      headersJson: "{}",
      apiKeyHeader: "x-api-key",
      payloadTemplate: DEFAULT_PAYLOAD_TEMPLATE,
      isTestMode: true,
      autoEnabled: false,
      autoIntervalMinutes: 15,
      defaultLatitude: DEFAULT_SIMULATION_COORDINATES.latitude,
      defaultLongitude: DEFAULT_SIMULATION_COORDINATES.longitude,
      useGeneralLocation: true,
    };
    await db
      .insert(alertTypes)
      .values(values)
      .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  }
  return db.select().from(alertTypes).where(eq(alertTypes.userId, userId));
}

export async function listAlertTypes(userId: number) {
  await ensureDefaultAlertTypes(userId);
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertTypes).where(eq(alertTypes.userId, userId));
}

export async function getGeneralSettings(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const records = await db.select().from(generalSettings).where(eq(generalSettings.userId, userId)).limit(1);
  if (records[0]) return records[0];

  await db.insert(generalSettings).values({
    userId,
    defaultLatitude: DEFAULT_SIMULATION_COORDINATES.latitude,
    defaultLongitude: DEFAULT_SIMULATION_COORDINATES.longitude,
  }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });

  const created = await db.select().from(generalSettings).where(eq(generalSettings.userId, userId)).limit(1);
  if (!created[0]) throw new Error("Não foi possível inicializar as configurações gerais.");
  return created[0];
}

export async function updateGeneralSettings(userId: number, input: { defaultLatitude: number; defaultLongitude: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(generalSettings).values({ userId, ...input }).onDuplicateKeyUpdate({
    set: { ...input, updatedAt: new Date() },
  });
  return getGeneralSettings(userId);
}

export async function resetGeneratedOperationalData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db.transaction(async tx => {
    const workflowLogs = await tx.delete(workflowProcessLogs).where(eq(workflowProcessLogs.userId, userId));
    const workflowOccurrences = await tx.delete(receivedWorkflowOccurrences).where(eq(receivedWorkflowOccurrences.userId, userId));
    const receipts = await tx.delete(mockReceipts).where(eq(mockReceipts.userId, userId));
    const dispatched = await tx.delete(dispatchedAlerts).where(eq(dispatchedAlerts.userId, userId));
    return {
      workflowLogs: Number(workflowLogs[0].affectedRows ?? 0),
      workflowOccurrences: Number(workflowOccurrences[0].affectedRows ?? 0),
      receipts: Number(receipts[0].affectedRows ?? 0),
      dispatchedAlerts: Number(dispatched[0].affectedRows ?? 0),
    };
  });
}

export async function getAlertTypeForUser(userId: number, alertTypeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const records = await db
    .select()
    .from(alertTypes)
    .where(and(eq(alertTypes.id, alertTypeId), eq(alertTypes.userId, userId)))
    .limit(1);
  return records[0];
}

export async function getAlertTypeByScheduleTask(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const records = await db
    .select()
    .from(alertTypes)
    .where(eq(alertTypes.scheduleCronTaskUid, taskUid))
    .limit(1);
  return records[0];
}

export async function getAlertTypeByApiKey(apiKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const records = await db.select().from(alertTypes).where(eq(alertTypes.apiKey, apiKey)).limit(1);
  return records[0];
}

export async function getWorkflowOccurrenceByExternalId(alertTypeId: number, externalId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const records = await db
    .select()
    .from(receivedWorkflowOccurrences)
    .where(and(eq(receivedWorkflowOccurrences.alertTypeId, alertTypeId), eq(receivedWorkflowOccurrences.externalId, externalId)))
    .limit(1);
  return records[0];
}

export async function createWorkflowOccurrence(input: {
  userId: number;
  alertTypeId: number;
  externalId: string;
  code: string;
  priority: string;
  status: string;
  eventType: string;
  title: string;
  narrative: string;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  payloadJson: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(receivedWorkflowOccurrences).values(input);
  return Number(result[0].insertId);
}

export async function createWorkflowProcessLog(input: {
  userId?: number | null;
  alertTypeId?: number | null;
  externalId?: string | null;
  outcome: string;
  httpStatus: number;
  reason?: string | null;
  payloadJson?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(workflowProcessLogs).values(input);
  return Number(result[0].insertId);
}

export async function updateAlertType(
  userId: number,
  alertTypeId: number,
  values: Partial<{
    name: string;
    defaultDescription: string;
    defaultSeverity: Severity;
    endpointUrl: string;
    headersJson: string;
    authToken: string | null;
    apiKey: string | null;
    apiKeyHeader: string;
    payloadTemplate: string;
    isTestMode: boolean;
    autoEnabled: boolean;
    autoIntervalMinutes: number;
    defaultLatitude: number;
    defaultLongitude: number;
    useGeneralLocation: boolean;
    scheduleCronTaskUid: string | null;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db
    .update(alertTypes)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(alertTypes.id, alertTypeId), eq(alertTypes.userId, userId)));
  return getAlertTypeForUser(userId, alertTypeId);
}

export async function createDispatchedAlert(input: {
  userId: number;
  alertTypeId: number;
  category: EventCategory;
  eventName: string;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  narrative: string;
  severity: Severity;
  endpointUrl: string;
  payloadJson: string;
  isSimulated: boolean;
  simulationSeed: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(dispatchedAlerts).values(input);
  return Number(result[0].insertId);
}

export async function updateDispatchedAlert(
  alertId: number,
  input: {
    status: DeliveryStatus;
    responseHttpStatus?: number | null;
    responseSummary?: string | null;
    failureReason?: string | null;
    attemptCount: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db
    .update(dispatchedAlerts)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(dispatchedAlerts.id, alertId));
}

export async function recordMockReceipt(input: {
  userId: number;
  dispatchedAlertId: number;
  payloadJson: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(mockReceipts).values(input);
}

export async function listDispatchedAlerts(userId: number, limit = 60) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dispatchedAlerts)
    .where(eq(dispatchedAlerts.userId, userId))
    .orderBy(desc(dispatchedAlerts.sentAt))
    .limit(limit);
}

export async function queryWorkflowMonitor(database: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, limit = 60) {
  const [occurrences, logs] = await Promise.all([
    database.select().from(receivedWorkflowOccurrences).where(eq(receivedWorkflowOccurrences.userId, userId)).orderBy(desc(receivedWorkflowOccurrences.receivedAt)).limit(limit),
    database.select().from(workflowProcessLogs).where(eq(workflowProcessLogs.userId, userId)).orderBy(desc(workflowProcessLogs.createdAt)).limit(limit),
  ]);
  return { occurrences, logs };
}

export async function getWorkflowMonitor(userId: number, limit = 60) {
  const db = await getDb();
  if (!db) return { occurrences: [], logs: [] };
  return queryWorkflowMonitor(db, userId, limit);
}

export async function getDashboardMetrics(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db
    .select({
      category: dispatchedAlerts.category,
      status: dispatchedAlerts.status,
      total: sql<number>`count(*)`,
    })
    .from(dispatchedAlerts)
    .where(and(eq(dispatchedAlerts.userId, userId), gte(dispatchedAlerts.sentAt, since)))
    .groupBy(dispatchedAlerts.category, dispatchedAlerts.status);
}
