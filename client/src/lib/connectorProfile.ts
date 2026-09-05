import type { ConnectorDescriptor } from "@shared/connectors/types";

type ConnectorDraft = {
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
 * Aplica, em uma única ação, todos os campos de integração descritos por um
 * ConnectorDescriptor (Framework Universal de Conectores, Seção 9 do Master).
 * Esta é a ÚNICA implementação: adicionar um novo destino não exige escrever
 * uma nova função de perfil, apenas registrar o descriptor em
 * `shared/connectors/registry.ts`.
 */
export function applyConnectorProfile<T extends ConnectorDraft>(connector: ConnectorDescriptor, draft: T): T {
  return {
    ...draft,
    endpointUrl: connector.endpointUrl,
    headersJson: "{}",
    authToken: "",
    clearToken: true,
    apiKeyHeader: connector.apiKeyHeader ?? draft.apiKeyHeader,
    clearApiKey: connector.clearApiKeyOnApply,
    isTestMode: connector.isTestModeDefault,
    payloadTemplate: connector.payloadTemplate,
  };
}
