/**
 * Observabilidade (Seção 36 do Prompt Master): logs estruturados (JSON, uma
 * linha por evento) para que operações críticas do Motor de Eventos sejam
 * rastreáveis ponta a ponta por correlationId/eventId, sem depender de
 * parsing de texto livre.
 *
 * Escopo deliberadamente mínimo: um `console.log`/`console.error` com JSON
 * estruturado. Isso já é suficiente para qualquer coletor de logs (CloudWatch,
 * Loki, etc.) indexar por campo. Dashboards e métricas agregadas ficam em
 * backlog (dependem de qual coletor/APM será adotado — não cabe a este
 * módulo decidir, Seção 46).
 */

export type LogLevel = "info" | "warn" | "error";

export interface EventLogFields {
  correlationId?: string;
  eventId?: string;
  tenantId?: string;
  userId?: number;
  alertTypeId?: number;
  connectorId?: string;
  category?: string;
  attempt?: number;
  httpStatus?: number | null;
  [key: string]: unknown;
}

export function logEvent(level: LogLevel, event: string, fields: EventLogFields = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
