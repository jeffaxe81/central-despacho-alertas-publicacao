import { CONNECTOR_AXE } from "@shared/connectors/registry";
import { applyConnectorProfile } from "@/lib/connectorProfile";

/**
 * Mantido como wrapper fino sobre o Framework de Conectores (connectorProfile.ts
 * + shared/connectors/registry.ts) para preservar compatibilidade com o código
 * e os testes existentes que já importam este módulo (Seção 35 do Master:
 * priorizar refatoração incremental em vez de reescrita total).
 */
export const ALRT_AXE_HOMOLOGATION_ENDPOINT = CONNECTOR_AXE.endpointUrl;

type AlrtAxeDraft = Parameters<typeof applyConnectorProfile>[1];

export function applyAlrtAxeProfile<T extends AlrtAxeDraft>(draft: T): T {
  return applyConnectorProfile(CONNECTOR_AXE, draft);
}
