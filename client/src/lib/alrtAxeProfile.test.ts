import { describe, expect, it } from "vitest";
import { ALRT_AXE_HOMOLOGATION_ENDPOINT, applyAlrtAxeProfile } from "./alrtAxeProfile";

describe("perfil ALRT → AXE", () => {
  it("preenche atomicamente endpoint, autenticação, modo e payload de homologação", () => {
    const result = applyAlrtAxeProfile({
      endpointUrl: "mock://central-despacho",
      headersJson: '{"x-origem":"antigo"}',
      authToken: "bearer-antigo",
      clearToken: false,
      apiKeyHeader: "x-api-key",
      clearApiKey: true,
      isTestMode: true,
      payloadTemplate: "{}",
      apiKey: "api-key-existente",
    });

    expect(result).toMatchObject({
      endpointUrl: ALRT_AXE_HOMOLOGATION_ENDPOINT,
      headersJson: "{}",
      authToken: "",
      clearToken: true,
      apiKeyHeader: "X-ALRT-API-Key",
      clearApiKey: false,
      isTestMode: false,
      apiKey: "api-key-existente",
      payloadTemplate: expect.stringContaining('"eventType": "alert.received"'),
    });
  });
});
