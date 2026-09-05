import { ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE, ALRT_CRM_INGRESS_PAYLOAD_TEMPLATE } from "../alertSimulation";
import type { ConnectorDescriptor } from "./types";

export const CONNECTOR_AXE: ConnectorDescriptor = {
  id: "axe-dispatch",
  label: "Aplicar ALRT → AXE",
  targetSystem: "AXE Dispatch (Despacho)",
  version: "1.0",
  status: "homologado",
  endpointUrl: "https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events",
  authStrategy: "api-key+hmac",
  apiKeyHeader: "X-ALRT-API-Key",
  clearApiKeyOnApply: false,
  isTestModeDefault: false,
  payloadTemplate: ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE,
  requiredEnvelopeFields: ["schemaVersion", "eventId", "eventType", "occurredAt", "correlationId", "idempotencyKey"],
  description:
    "Contrato homologado com o AXE Dispatch: alert.received, envelope versionado, HMAC-SHA256 e X-ALRT-API-Key.",
};

export const CONNECTOR_CRM: ConnectorDescriptor = {
  id: "crm-occurrence",
  label: "Aplicar ALRT → CRM (proposta)",
  targetSystem: "CRM",
  version: "1.0",
  status: "proposta",
  endpointUrl: "",
  authStrategy: "api-key",
  apiKeyHeader: "X-ALRT-API-Key",
  clearApiKeyOnApply: true,
  isTestModeDefault: true,
  payloadTemplate: ALRT_CRM_INGRESS_PAYLOAD_TEMPLATE,
  requiredEnvelopeFields: ["schemaVersion", "eventId", "eventType", "occurredAt", "correlationId", "idempotencyKey"],
  description:
    "Proposta de envelope para o CRM (occurrence.registered), aguardando contrato oficial. Mantém modo teste e endpoint vazio até confirmação.",
};

/**
 * Todo novo destino (Despacho, CRM, ou outro módulo da plataforma) entra aqui.
 * A UI de integração e os testes de contrato leem esta lista — nada precisa
 * ser duplicado por conector.
 */
export const CONNECTORS: ConnectorDescriptor[] = [CONNECTOR_AXE, CONNECTOR_CRM];
