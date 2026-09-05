import { describe, expect, it } from "vitest";
import { CONNECTORS } from "./registry";
import { checkConnectorContract } from "./types";

describe("contrato dos conectores registrados", () => {
  it.each(CONNECTORS)("$label ($id) contém os campos mínimos do envelope versionado", connector => {
    const result = checkConnectorContract(connector);
    expect(result.missingFields).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("conectores em status 'proposta' nunca têm endpoint real nem saem do modo teste por padrão", () => {
    for (const connector of CONNECTORS) {
      if (connector.status === "proposta") {
        expect(connector.endpointUrl).toBe("");
        expect(connector.isTestModeDefault).toBe(true);
      }
    }
  });

  it("nenhum conector duplica id ou rótulo de botão", () => {
    const ids = CONNECTORS.map(c => c.id);
    const labels = CONNECTORS.map(c => c.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
