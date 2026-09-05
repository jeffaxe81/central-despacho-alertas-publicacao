import { CONNECTOR_CRM } from "@shared/connectors/registry";
import { applyConnectorProfile } from "@/lib/connectorProfile";

/**
 * Wrapper fino sobre o Framework de Conectores — ver alrtAxeProfile.ts.
 * O conector CRM é "proposta": endpoint vazio e modo teste, até confirmação
 * de contrato oficial (ver relatorio-conformidade-master.md).
 */
export const ALRT_CRM_PLACEHOLDER_ENDPOINT = CONNECTOR_CRM.endpointUrl;

type AlrtCrmDraft = Parameters<typeof applyConnectorProfile>[1];

export function applyAlrtCrmProfile<T extends AlrtCrmDraft>(draft: T): T {
  return applyConnectorProfile(CONNECTOR_CRM, draft);
}
