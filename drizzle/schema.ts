import {
  boolean,
  double,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  DELIVERY_STATUS_OPTIONS,
  EVENT_CATEGORIES,
  SEVERITY_OPTIONS,
} from "../shared/alertSimulation";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

const eventCategoryValues = EVENT_CATEGORIES.map(item => item.key) as [
  (typeof EVENT_CATEGORIES)[number]["key"],
  ...(typeof EVENT_CATEGORIES)[number]["key"][],
];
const severityValues = SEVERITY_OPTIONS as unknown as [
  (typeof SEVERITY_OPTIONS)[number],
  ...(typeof SEVERITY_OPTIONS)[number][],
];
const deliveryStatusValues = DELIVERY_STATUS_OPTIONS as unknown as [
  (typeof DELIVERY_STATUS_OPTIONS)[number],
  ...(typeof DELIVERY_STATUS_OPTIONS)[number][],
];

export const alertTypes = mysqlTable(
  "alert_types",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    category: mysqlEnum("category", eventCategoryValues).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    defaultDescription: text("default_description").notNull(),
    defaultSeverity: mysqlEnum("default_severity", severityValues).notNull(),
    endpointUrl: text("endpoint_url").notNull(),
    headersJson: text("headers_json").notNull(),
    authToken: text("auth_token"),
    apiKey: text("api_key"),
    apiKeyHeader: varchar("api_key_header", { length: 100 }).notNull().default("x-api-key"),
    payloadTemplate: text("payload_template").notNull(),
    isTestMode: boolean("is_test_mode").notNull().default(true),
    autoEnabled: boolean("auto_enabled").notNull().default(false),
    autoIntervalMinutes: int("auto_interval_minutes").notNull().default(15),
    defaultLatitude: double("default_latitude").notNull().default(-15.793889),
    defaultLongitude: double("default_longitude").notNull().default(-47.882778),
    useGeneralLocation: boolean("use_general_location").notNull().default(true),
    scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("alert_types_user_category_unique").on(table.userId, table.category),
    index("alert_types_schedule_task_idx").on(table.scheduleCronTaskUid),
  ]
);

export const generalSettings = mysqlTable(
  "general_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    defaultLatitude: double("default_latitude").notNull().default(-15.793889),
    defaultLongitude: double("default_longitude").notNull().default(-47.882778),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("general_settings_user_unique").on(table.userId)]
);

export const dispatchedAlerts = mysqlTable(
  "dispatched_alerts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    alertTypeId: int("alert_type_id").notNull(),
    category: mysqlEnum("category", eventCategoryValues).notNull(),
    eventName: varchar("event_name", { length: 160 }).notNull(),
    address: varchar("address", { length: 320 }).notNull(),
    neighborhood: varchar("neighborhood", { length: 160 }).notNull(),
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
    narrative: text("narrative").notNull(),
    severity: mysqlEnum("severity", severityValues).notNull(),
    status: mysqlEnum("status", deliveryStatusValues).notNull().default("pendente"),
    endpointUrl: text("endpoint_url").notNull(),
    payloadJson: text("payload_json").notNull(),
    responseHttpStatus: int("response_http_status"),
    responseSummary: text("response_summary"),
    failureReason: text("failure_reason"),
    attemptCount: int("attempt_count").notNull().default(0),
    isSimulated: boolean("is_simulated").notNull().default(true),
    simulationSeed: varchar("simulation_seed", { length: 64 }).notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("dispatched_alerts_user_sent_idx").on(table.userId, table.sentAt),
    index("dispatched_alerts_type_idx").on(table.alertTypeId),
    index("dispatched_alerts_status_idx").on(table.status),
  ]
);

export const mockReceipts = mysqlTable(
  "mock_receipts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    dispatchedAlertId: int("dispatched_alert_id").notNull(),
    payloadJson: text("payload_json").notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  table => [index("mock_receipts_alert_idx").on(table.dispatchedAlertId)]
);

export const receivedWorkflowOccurrences = mysqlTable(
  "received_workflow_occurrences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    alertTypeId: int("alert_type_id").notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    code: varchar("code", { length: 180 }).notNull(),
    priority: varchar("priority", { length: 24 }).notNull(),
    status: varchar("status", { length: 48 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    narrative: text("narrative").notNull(),
    address: varchar("address", { length: 320 }).notNull(),
    neighborhood: varchar("neighborhood", { length: 160 }).notNull(),
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
    payloadJson: text("payload_json").notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("workflow_occurrence_alert_external_unique").on(table.alertTypeId, table.externalId),
    index("workflow_occurrence_user_received_idx").on(table.userId, table.receivedAt),
  ]
);

export const workflowProcessLogs = mysqlTable(
  "workflow_process_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id"),
    alertTypeId: int("alert_type_id"),
    externalId: varchar("external_id", { length: 160 }),
    outcome: varchar("outcome", { length: 24 }).notNull(),
    httpStatus: int("http_status").notNull(),
    reason: text("reason"),
    payloadJson: text("payload_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [
    index("workflow_process_logs_alert_created_idx").on(table.alertTypeId, table.createdAt),
    index("workflow_process_logs_external_idx").on(table.externalId),
  ]
);

export type AlertType = typeof alertTypes.$inferSelect;
export type NewAlertType = typeof alertTypes.$inferInsert;
export type DispatchedAlert = typeof dispatchedAlerts.$inferSelect;
export type ReceivedWorkflowOccurrence = typeof receivedWorkflowOccurrences.$inferSelect;
export type WorkflowProcessLog = typeof workflowProcessLogs.$inferSelect;
