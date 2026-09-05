import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { nanoid } from "nanoid";
import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  DEFAULT_PAYLOAD_TEMPLATE,
  DELIVERY_STATUS_OPTIONS,
  EVENT_CATEGORIES,
  SEVERITY_OPTIONS,
} from "../shared/alertSimulation";
import type { Severity } from "../shared/alertSimulation";
import { dispatchConfiguredAlert, generateOccurrence, interpolatePayload, intervalToCron, parseHeaders } from "./alertEngine";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { makeRequest, type GeocodingResult } from "./_core/map";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { hashPassword, verifyPassword } from "./passwordAuth";

const categoryValues = EVENT_CATEGORIES.map(item => item.key) as [string, ...string[]];
const severityValues = [...SEVERITY_OPTIONS] as [string, ...string[]];
const deliveryStatusValues = [...DELIVERY_STATUS_OPTIONS] as [string, ...string[]];
const passwordInput = z.string().min(10, "Use pelo menos 10 caracteres na senha.").max(128);
const emailInput = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(320);
const axePriorityBySeverity: Record<Severity, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
  baixa: "LOW",
  media: "MEDIUM",
  alta: "HIGH",
  critica: "CRITICAL",
};

function assertAxePayloadContract(payload: Record<string, unknown>) {
  if (payload.schemaVersion !== "1.0") return;
  if (typeof payload.eventId === "string") {
    const required = ["eventId", "eventType", "occurredAt", "correlationId", "idempotencyKey"];
    const missing = required.filter(field => typeof payload[field] !== "string" || !String(payload[field]).trim());
    const source = payload.source;
    const sourceSystem = source && typeof source === "object" && !Array.isArray(source) ? (source as Record<string, unknown>).system : undefined;
    const sourceEnvironment = source && typeof source === "object" && !Array.isArray(source) ? (source as Record<string, unknown>).environment : undefined;
    const alert = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>).alert
      : undefined;
    const alertRecord = alert && typeof alert === "object" && !Array.isArray(alert) ? alert as Record<string, unknown> : undefined;
    const alertRequired = ["externalId", "category", "priority", "description", "address", "reportedAt"];
    const missingAlert = alertRequired.filter(field => typeof alertRecord?.[field] !== "string" || !String(alertRecord[field]).trim());
    const latitude = Number(alertRecord?.latitude);
    const longitude = Number(alertRecord?.longitude);
    const validPriority = typeof alertRecord?.priority === "string" && severityValues.includes(alertRecord.priority);
    const validCoordinates = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
    if (missing.length || sourceSystem !== "despacho-alrt" || sourceEnvironment !== "homologacao" || missingAlert.length || !validPriority || !validCoordinates) {
      throw new Error("Perfil ALRT → AXE inválido: revise o envelope, source, data.alert, prioridade e coordenadas.");
    }
    return;
  }
  const required = ["id", "code", "priority", "status", "createdAt", "eventType", "title", "narrative"];
  const missing = required.filter(field => typeof payload[field] !== "string" || !String(payload[field]).trim());
  const location = payload.location;
  const latitude = location && typeof location === "object" && !Array.isArray(location) ? Number((location as Record<string, unknown>).latitude) : NaN;
  const longitude = location && typeof location === "object" && !Array.isArray(location) ? Number((location as Record<string, unknown>).longitude) : NaN;
  const hasCoordinates = Boolean(
    location && typeof location === "object" && !Array.isArray(location) &&
    Number.isFinite(latitude) && Number.isFinite(longitude)
  );
  if (missing.length || !hasCoordinates) {
    throw new Error(`Perfil AXE inválido: revise ${[...missing, ...(hasCoordinates ? [] : ["location.latitude/location.longitude"])].join(", ")}.`);
  }
}

const updateAlertTypeInput = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(3).max(160),
  defaultDescription: z.string().trim().min(8).max(2000),
  defaultSeverity: z.enum(severityValues),
  endpointUrl: z.string().trim().min(8).max(2000),
  headersJson: z.string().trim().max(8000),
  authToken: z.string().max(4000).optional(),
  apiKey: z.string().max(4000).optional(),
  apiKeyHeader: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/, "Nome de cabeçalho de API key inválido.").default("x-api-key"),
  payloadTemplate: z.string().trim().min(2).max(16000),
  isTestMode: z.boolean(),
  defaultLatitude: z.number().min(-90).max(90),
  defaultLongitude: z.number().min(-180).max(180),
  useGeneralLocation: z.boolean().default(true),
});

function safeAlertType(alertType: Awaited<ReturnType<typeof db.getAlertTypeForUser>> extends infer T ? NonNullable<T> : never) {
  const { authToken: _token, apiKey: _apiKey, ...safe } = alertType;
  return { ...safe, hasAuthToken: Boolean(_token), hasApiKey: Boolean(_apiKey) };
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(z.object({
      name: z.string().trim().min(2, "Informe seu nome.").max(120),
      email: emailInput,
      password: passwordInput,
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getUserByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com este e-mail." });

      const user = await db.createPasswordUser({
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
      });
      const session = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return { id: user.id, name: user.name, email: user.email };
    }),
    login: publicProcedure.input(z.object({ email: emailInput, password: passwordInput })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(input.email);
      if (!user || !await verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
      }

      await db.recordPasswordLogin(user.id);
      const session = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return { id: user.id, name: user.name, email: user.email };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  alerts: router({
    generalSettings: protectedProcedure.query(({ ctx }) => db.getGeneralSettings(ctx.user.id)),
    updateGeneralSettings: protectedProcedure.input(z.object({
      defaultLatitude: z.number().min(-90).max(90),
      defaultLongitude: z.number().min(-180).max(180),
    })).mutation(({ ctx, input }) => db.updateGeneralSettings(ctx.user.id, input)),
    geocodeAddress: protectedProcedure.input(z.object({ address: z.string().trim().min(5).max(320) })).mutation(async ({ input }) => {
      const response = await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address: input.address });
      const first = response.results[0];
      if (!first) throw new Error("Endereço não localizado. Tente informar rua, número, cidade e UF.");
      return {
        formattedAddress: first.formatted_address,
        latitude: first.geometry.location.lat,
        longitude: first.geometry.location.lng,
      };
    }),
    resetGeneratedData: protectedProcedure.input(z.object({ confirmation: z.literal("LIMPAR DADOS GERADOS") })).mutation(({ ctx }) => db.resetGeneratedOperationalData(ctx.user.id)),
    eventTypes: protectedProcedure.query(async ({ ctx }) => {
      const types = await db.listAlertTypes(ctx.user.id);
      return types.map(type => safeAlertType(type));
    }),
    updateEventType: protectedProcedure.input(updateAlertTypeInput).mutation(async ({ ctx, input }) => {
      parseHeaders(input.headersJson);
      const previewPayload = interpolatePayload(input.payloadTemplate, {
        alertId: "SIM-EXEMPLO",
        category: "categoria",
        eventName: input.name,
        severity: input.defaultSeverity,
        timestamp: new Date().toISOString(),
        address: "Rua Exemplo, nº 100",
        neighborhood: "Bairro Exemplo",
        latitude: input.defaultLatitude,
        longitude: input.defaultLongitude,
        coordinates: `${input.defaultLatitude},${input.defaultLongitude}`,
        narrative: "Narrativa de exemplo",
        correlationId: "corr_00000000-0000-0000-0000-000000000000",
        isTestMode: input.isTestMode,
        axePriority: axePriorityBySeverity[input.defaultSeverity as Severity],
      });
      assertAxePayloadContract(previewPayload);
      const current = await db.getAlertTypeForUser(ctx.user.id, input.id);
      if (!current) throw new Error("Tipo de evento não encontrado.");
      const updated = await db.updateAlertType(ctx.user.id, input.id, {
        ...input,
        defaultSeverity: input.defaultSeverity as Severity,
        defaultLatitude: input.defaultLatitude,
        defaultLongitude: input.defaultLongitude,
        useGeneralLocation: input.useGeneralLocation,
        authToken: input.authToken === undefined ? current.authToken : input.authToken.trim() || null,
        apiKey: input.apiKey === undefined ? current.apiKey : input.apiKey.trim() || null,
        apiKeyHeader: input.apiKeyHeader,
      });
      if (!updated) throw new Error("Não foi possível atualizar o tipo de evento.");
      return safeAlertType(updated);
    }),
    preview: protectedProcedure
      .input(z.object({ category: z.enum(categoryValues), severity: z.enum(severityValues) }))
      .query(({ input }) => generateOccurrence(input.category as any, input.severity as any)),
    dispatch: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    }).refine(input => (input.latitude === undefined) === (input.longitude === undefined), {
      message: "Latitude e longitude devem ser informadas juntas.",
    })).mutation(async ({ ctx, input }) => {
      const alertType = await db.getAlertTypeForUser(ctx.user.id, input.id);
      if (!alertType) throw new Error("Tipo de evento não encontrado.");
      const coordinates = input.latitude === undefined ? undefined : { latitude: input.latitude, longitude: input.longitude! };
      const generalSettings = alertType.useGeneralLocation ? await db.getGeneralSettings(ctx.user.id) : undefined;
      return dispatchConfiguredAlert(alertType, coordinates, generalSettings ? { latitude: generalSettings.defaultLatitude, longitude: generalSettings.defaultLongitude } : undefined);
    }),
    history: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(60) }).default({ limit: 60 }))
      .query(({ ctx, input }) => db.listDispatchedAlerts(ctx.user.id, input.limit)),
    workflowMonitor: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(60) }).default({ limit: 60 }))
      .query(({ ctx, input }) => db.getWorkflowMonitor(ctx.user.id, input.limit)),
    metrics: protectedProcedure.query(({ ctx }) => db.getDashboardMetrics(ctx.user.id)),
    configureAutomation: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), enabled: z.boolean(), intervalMinutes: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const alertType = await db.getAlertTypeForUser(ctx.user.id, input.id);
        if (!alertType) throw new Error("Tipo de evento não encontrado.");
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        if (!sessionToken) throw new Error("Sessão indisponível para configurar a automação.");

        if (!input.enabled) {
          if (alertType.scheduleCronTaskUid) {
            await updateHeartbeatJob(alertType.scheduleCronTaskUid, { enable: false }, sessionToken);
          }
          return db.updateAlertType(ctx.user.id, input.id, { autoEnabled: false, autoIntervalMinutes: input.intervalMinutes });
        }

        const cron = intervalToCron(input.intervalMinutes);
        let taskUid = alertType.scheduleCronTaskUid;
        if (taskUid) {
          await updateHeartbeatJob(taskUid, { cron, enable: true }, sessionToken);
        } else {
          const job = await createHeartbeatJob(
            {
              name: `alerta-urbano-${ctx.user.id}-${alertType.id}`,
              cron,
              path: "/api/scheduled/dispatch-alert",
              payload: { alertTypeId: alertType.id },
              description: `Disparo automático de ${alertType.name}`,
            },
            sessionToken
          );
          taskUid = job.taskUid;
        }
        return db.updateAlertType(ctx.user.id, input.id, {
          autoEnabled: true,
          autoIntervalMinutes: input.intervalMinutes,
          scheduleCronTaskUid: taskUid,
        });
      }),
    deleteAutomation: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const alertType = await db.getAlertTypeForUser(ctx.user.id, input.id);
      if (!alertType) throw new Error("Tipo de evento não encontrado.");
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (alertType.scheduleCronTaskUid && sessionToken) {
        await deleteHeartbeatJob(alertType.scheduleCronTaskUid, sessionToken);
      }
      return db.updateAlertType(ctx.user.id, input.id, { autoEnabled: false, scheduleCronTaskUid: null });
    }),
  }),
  eventSubscriptions: router({
    list: protectedProcedure.query(({ ctx }) => db.listEventSubscriptions(ctx.user.id)),
    create: protectedProcedure.input(z.object({
      label: z.string().trim().min(3).max(160),
      category: z.enum(categoryValues).nullable(),
      deliveryMode: z.enum(["webhook", "sse"]),
      endpointUrl: z.string().trim().url().max(2000).optional(),
      headersJson: z.string().trim().max(8000).default("{}"),
      outboundApiKeyHeader: z.string().trim().min(1).max(100).default("X-ALRT-API-Key"),
      outboundApiKey: z.string().max(4000).optional(),
    })).mutation(async ({ ctx, input }) => {
      if (input.deliveryMode === "webhook" && !input.endpointUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a URL de destino para assinaturas do tipo webhook." });
      }
      parseHeaders(input.headersJson);
      // Gerada uma única vez e devolvida na criação; não é possível recuperá-la depois
      // (mesmo padrão de segredo de API key usado no restante da plataforma).
      const subscriberApiKey = `sub_${nanoid(32)}`;
      const id = await db.createEventSubscription({
        userId: ctx.user.id,
        tenantId: ctx.user.tenantId,
        label: input.label,
        category: input.category,
        deliveryMode: input.deliveryMode,
        endpointUrl: input.endpointUrl ?? null,
        headersJson: input.headersJson,
        outboundApiKeyHeader: input.outboundApiKeyHeader,
        outboundApiKey: input.outboundApiKey ?? null,
        subscriberApiKey,
        isActive: true,
      });
      return { id, subscriberApiKey };
    }),
    setActive: protectedProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(({ ctx, input }) => db.setEventSubscriptionActive(ctx.user.id, input.id, input.isActive)),
  }),
});

export type AppRouter = typeof appRouter;
