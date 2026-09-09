import { describe, expect, it } from "vitest";
import { canonicalEventSchema } from "./canonicalEvent";

const validEvent = {
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
    status: "apagada",
  },
};

describe("canonicalEventSchema", () => {
  it("aceita um evento universal simulado e preserva os dados do domínio", () => {
    const parsed = canonicalEventSchema.parse(validEvent);

    expect(parsed.data).toEqual({ assetId: "LUM-00125", status: "apagada" });
    expect(parsed.type).toBe("com.axesistemas.iluminacao.luminaria.falha.v1");
  });

  it("rejeita evento sem rastreabilidade da execução", () => {
    const { axesrunid: _removed, ...withoutRunId } = validEvent;

    expect(canonicalEventSchema.safeParse(withoutRunId).success).toBe(false);
  });

  it("rejeita evento que não esteja explicitamente marcado como simulado", () => {
    expect(
      canonicalEventSchema.safeParse({ ...validEvent, axessimulated: false })
        .success
    ).toBe(false);
  });

  it.each([
    ["bigint", 1n],
    ["undefined", undefined],
    ["função", () => 1],
    ["NaN", Number.NaN],
    ["infinito", Number.POSITIVE_INFINITY],
    ["undefined aninhado", { nested: ["ok", undefined] }],
  ])(
    "rejeita valor %s que não pode ser representado fielmente em JSON",
    (_kind, invalid) => {
      expect(
        canonicalEventSchema.safeParse({ ...validEvent, data: { invalid } })
          .success
      ).toBe(false);
    }
  );

  it("aceita valores JSON aninhados e versão SemVer com major zero", () => {
    const candidate = {
      ...validEvent,
      axesscenarioversion: "0.1.0",
      data: {
        enabled: true,
        value: null,
        readings: [1, "dois", { ok: false }],
      },
    };

    expect(canonicalEventSchema.safeParse(candidate).success).toBe(true);
  });

  it.each([
    ["specversion", { ...validEvent, specversion: "0.3" }],
    ["tipo", { ...validEvent, type: "iluminacao.falha" }],
    [
      "tipo sem entidade e ação",
      { ...validEvent, type: "com.axesistemas.foo.v1" },
    ],
    ["schema", { ...validEvent, dataschema: "schema-sem-versao" }],
    [
      "schema sem nome",
      { ...validEvent, dataschema: "urn:axesistemas:schema:foo:1.0.0" },
    ],
    ["versão do cenário", { ...validEvent, axesscenarioversion: "v1" }],
    [
      "versão com zero à esquerda",
      { ...validEvent, axesscenarioversion: "1.01.0" },
    ],
  ])("rejeita %s fora do contrato canônico v1", (_field, candidate) => {
    expect(canonicalEventSchema.safeParse(candidate).success).toBe(false);
  });
});
