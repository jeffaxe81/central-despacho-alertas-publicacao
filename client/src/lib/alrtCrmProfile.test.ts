import { describe, expect, it } from "vitest";
import { ALRT_CRM_PLACEHOLDER_ENDPOINT, applyAlrtCrmProfile } from "./alrtCrmProfile";

describe("perfil ALRT → CRM (proposta, aguardando contrato oficial)", () => {
  it("preenche envelope versionado mantendo modo teste e endpoint vazio", () => {
    const result = applyAlrtCrmProfile({
      endpointUrl: "mock://central-despacho",
      headersJson: '{"x-origem":"antigo"}',
      authToken: "bearer-antigo",
      clearToken: false,
      apiKeyHeader: "x-api-key",
      clearApiKey: false,
      isTestMode: false,
      payloadTemplate: "{}",
    });

    expect(result).toMatchObject({
      endpointUrl: ALRT_CRM_PLACEHOLDER_ENDPOINT,
      headersJson: "{}",
      authToken: "",
      clearToken: true,
      apiKeyHeader: "X-ALRT-API-Key",
      clearApiKey: true,
      isTestMode: true,
      payloadTemplate: expect.stringContaining('"eventType": "occurrence.registered"'),
    });
  });
});
