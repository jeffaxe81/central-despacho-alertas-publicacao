import { describe, expect, it } from "vitest";

const runAxeIntegrationTest = process.env.RUN_AXE_INTEGRATION_TEST === "true";
const axeApiKey = process.env.AXE_API_KEY;

describe.runIf(runAxeIntegrationTest)("saúde do receptor AXE de homologação", () => {
  it("aceita a API key configurada no endpoint de saúde", async () => {
    expect(axeApiKey).toBeTruthy();
    const response = await fetch("https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/health", {
      headers: { "X-ALRT-API-Key": axeApiKey! },
    });
    expect(response.status).toBe(200);
  }, 20_000);
});
