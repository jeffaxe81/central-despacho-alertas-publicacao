import { ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE } from "@shared/alertSimulation";

export const ALRT_AXE_HOMOLOGATION_ENDPOINT = "https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events";

type AlrtAxeDraft = {
  endpointUrl: string;
  headersJson: string;
  authToken: string;
  clearToken: boolean;
  apiKeyHeader: string;
  clearApiKey: boolean;
  isTestMode: boolean;
  payloadTemplate: string;
};

export function applyAlrtAxeProfile<T extends AlrtAxeDraft>(draft: T): T {
  return {
    ...draft,
    endpointUrl: ALRT_AXE_HOMOLOGATION_ENDPOINT,
    headersJson: "{}",
    authToken: "",
    clearToken: true,
    apiKeyHeader: "X-ALRT-API-Key",
    clearApiKey: false,
    isTestMode: false,
    payloadTemplate: ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE,
  };
}
