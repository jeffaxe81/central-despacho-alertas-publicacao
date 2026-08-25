import { describe, expect, it } from "vitest";
import { WORKFLOW_CONFIGURATION_STEPS, WORKFLOW_RECEIVER_URL, WORKFLOW_REQUIRED_HEADERS } from "./workflowIntegration";

describe("contrato de configuração do workflow", () => {
  it("expõe o endpoint publicado e os headers necessários", () => {
    expect(WORKFLOW_RECEIVER_URL).toBe("https://despachoalrt-hjwc4f8q.manus.space/api/integrations/occurrences");
    expect(WORKFLOW_REQUIRED_HEADERS).toEqual([
      { name: "Content-Type", value: "application/json" },
      { name: "x-api-key", value: "API key gerada e salva na categoria da central" },
    ]);
    expect(WORKFLOW_CONFIGURATION_STEPS).toHaveLength(4);
  });
});
