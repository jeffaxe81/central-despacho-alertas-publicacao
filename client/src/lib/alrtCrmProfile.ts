import { ALRT_CRM_INGRESS_PAYLOAD_TEMPLATE } from "@shared/alertSimulation";

/**
 * Endpoint do CRM ainda não confirmado por contrato oficial (ver
 * relatorio-conformidade-master.md, item de backlog "Integração CRM").
 * Mantido vazio propositalmente: nunca inventar URL de destino real.
 */
export const ALRT_CRM_PLACEHOLDER_ENDPOINT = "";

type AlrtCrmDraft = {
  endpointUrl: string;
  headersJson: string;
  authToken: string;
  clearToken: boolean;
  apiKeyHeader: string;
  clearApiKey: boolean;
  isTestMode: boolean;
  payloadTemplate: string;
};

/**
 * Aplica o modelo de envelope proposto para o CRM. Diferente do perfil ALRT → AXE
 * (homologado com contrato real), este perfil mantém isTestMode=true e endpoint
 * vazio até que o CRM confirme schema, autenticação e endpoint reais.
 */
export function applyAlrtCrmProfile<T extends AlrtCrmDraft>(draft: T): T {
  return {
    ...draft,
    endpointUrl: ALRT_CRM_PLACEHOLDER_ENDPOINT,
    headersJson: "{}",
    authToken: "",
    clearToken: true,
    apiKeyHeader: "X-ALRT-API-Key",
    clearApiKey: true,
    isTestMode: true,
    payloadTemplate: ALRT_CRM_INGRESS_PAYLOAD_TEMPLATE,
  };
}
