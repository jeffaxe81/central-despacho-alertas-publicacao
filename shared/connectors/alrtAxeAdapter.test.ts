import { describe, expect, it } from "vitest";
import { toAlrtAxeEvent } from "./alrtAxeAdapter";

const canonicalAlert = {
  specversion: "1.0",
  id: "evt_01JEXEMPLO001",
  source: "urn:axesistemas:motor-eventos",
  type: "com.axesistemas.iluminacao.luminaria.falha.v1",
  subject: "luminaria/LUM-00125",
  time: "2026-08-27T14:30:00.000Z",
  datacontenttype: "application/json",
  dataschema: "urn:axesistemas:schema:iluminacao:luminaria-falha:1.0.0",
  correlationid: "corr_01JEXEMPLO001",
  idempotencykey: "run_100:event_4:v1",
  axesrunid: "run_100",
  axesscenarioid: "cenario_iluminacao_noturna",
  axesscenarioversion: "1.0.0",
  axesseed: "brusque-noite-001",
  axessequence: 4,
  axessimulated: true,
  data: {
    assetId: "LUM-00125",
    category: "iluminacao_publica",
    severity: "media",
    description: "Luminária sem funcionamento no período noturno.",
    location: {
      address: "Rua Exemplo, 125",
      latitude: -27.0984,
      longitude: -48.9175,
    },
    domainOnlyField: "não deve vazar",
  },
};

describe("toAlrtAxeEvent", () => {
  it("converte o evento canônico no contrato ALRT → AXE homologado", () => {
    expect(toAlrtAxeEvent(canonicalAlert)).toEqual({
      schemaVersion: "1.0",
      eventId: "evt_01JEXEMPLO001",
      eventType: "alert.received",
      occurredAt: "2026-08-27T14:30:00.000Z",
      source: {
        system: "despacho-alrt",
        environment: "homologacao",
      },
      correlationId: "corr_01JEXEMPLO001",
      idempotencyKey: "run_100:event_4:v1",
      data: {
        alert: {
          externalId: "LUM-00125",
          category: "iluminacao_publica",
          priority: "media",
          description: "Luminária sem funcionamento no período noturno.",
          address: "Rua Exemplo, 125",
          latitude: -27.0984,
          longitude: -48.9175,
          reportedAt: "2026-08-27T14:30:00.000Z",
          sourceStatus: "novo",
        },
      },
    });
  });

  it("rejeita entrada que não cumpra o contrato canônico simulation-only", () => {
    expect(() =>
      toAlrtAxeEvent({ ...canonicalAlert, axessimulated: false })
    ).toThrow();
  });

  it.each([
    ["assetId ausente", { ...canonicalAlert.data, assetId: undefined }],
    ["prioridade inválida", { ...canonicalAlert.data, severity: "urgente" }],
    [
      "latitude fora do intervalo",
      {
        ...canonicalAlert.data,
        location: { ...canonicalAlert.data.location, latitude: -91 },
      },
    ],
    [
      "longitude como texto",
      {
        ...canonicalAlert.data,
        location: { ...canonicalAlert.data.location, longitude: "-48.9175" },
      },
    ],
  ])("rejeita projeção AXE inválida: %s", (_case, data) => {
    expect(() => toAlrtAxeEvent({ ...canonicalAlert, data })).toThrow();
  });
});
