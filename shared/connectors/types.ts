/**
 * Framework Universal de Conectores (Seção 9 do Prompt Master).
 *
 * Um Connector descreve COMO falar com um destino externo (AXE, CRM, futuros
 * módulos) de forma declarativa: versão do envelope, estratégia de autenticação,
 * modelo de payload e os campos mínimos exigidos pelo contrato. A regra de
 * negócio (o que disparar e quando) continua nos produtos; este arquivo só
 * descreve comunicação, transformação e contrato — nunca segredos reais.
 *
 * Adicionar um novo destino = registrar um novo ConnectorDescriptor em
 * `registry.ts`. Isso automaticamente entra na tela de integração (via
 * `CONNECTORS.map(...)`) e nos testes de contrato genéricos
 * (`registry.contract.test.ts`), sem duplicar código de UI ou de teste.
 */

export type ConnectorAuthStrategy = "none" | "api-key" | "api-key+hmac" | "bearer";

/**
 * "homologado": contrato oficial confirmado pelo destino (endpoint real testado).
 * "proposta": schema proposto por esta Central, aguardando confirmação do
 * time responsável pelo destino. Nunca deve ter endpoint real nem sair do modo teste.
 */
export type ConnectorStatus = "homologado" | "proposta";

export interface ConnectorDescriptor {
  id: string;
  /** Texto exato do botão/rótulo na UI de integração. */
  label: string;
  targetSystem: string;
  version: string;
  status: ConnectorStatus;
  /** Vazio quando ainda não há endpoint real confirmado (nunca inventar URL). */
  endpointUrl: string;
  authStrategy: ConnectorAuthStrategy;
  apiKeyHeader?: string;
  /** Se falso, mantém a API key já configurada ao aplicar o perfil. */
  clearApiKeyOnApply: boolean;
  isTestModeDefault: boolean;
  payloadTemplate: string;
  /** Chaves de nível superior que o envelope precisa conter (teste de contrato). */
  requiredEnvelopeFields: string[];
  description: string;
}

export interface ConnectorContractResult {
  connectorId: string;
  ok: boolean;
  missingFields: string[];
}

/**
 * Valida que o payloadTemplate declarado contém, ao menos como texto (chave
 * JSON), todos os campos exigidos pelo contrato do destino. É deliberadamente
 * simples (checagem textual, não parsing de JSON com template vars) para
 * funcionar tanto com templates JSON válidos quanto com os que usam
 * placeholders `{{...}}` fora de aspas (ex.: números).
 */
export function checkConnectorContract(connector: ConnectorDescriptor): ConnectorContractResult {
  const missingFields = connector.requiredEnvelopeFields.filter(
    field => !connector.payloadTemplate.includes(`"${field}"`)
  );
  return { connectorId: connector.id, ok: missingFields.length === 0, missingFields };
}
