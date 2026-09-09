import { z } from "zod";

const identifierSegment = "[a-z0-9]+(?:-[a-z0-9]+)*";
const semanticVersionCore =
  "(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)";
const axesEventType = new RegExp(
  `^com\\.axesistemas\\.${identifierSegment}\\.${identifierSegment}\\.${identifierSegment}\\.v[1-9][0-9]*$`
);
const axesDataSchema = new RegExp(
  `^urn:axesistemas:schema:${identifierSegment}:${identifierSegment}:${semanticVersionCore}$`
);
const semanticVersion = new RegExp(`^${semanticVersionCore}$`);

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

/**
 * Envelope canônico interno do Motor Universal de Eventos.
 *
 * O núcleo aceita apenas eventos sintéticos nesta primeira versão. Contratos
 * legados, como ALRT -> AXE, continuam nas bordas e serão atendidos por
 * adaptadores em uma microentrega posterior.
 */
export const canonicalEventSchema = z
  .object({
    specversion: z.literal("1.0"),
    id: z.string().trim().min(1).max(160),
    source: z
      .string()
      .trim()
      .regex(/^urn:axesistemas:[a-z0-9-]+(?::[a-z0-9-]+)*$/),
    type: z.string().trim().regex(axesEventType),
    subject: z.string().trim().min(1).max(300).optional(),
    time: z.iso.datetime({ offset: true }),
    datacontenttype: z.literal("application/json"),
    dataschema: z.string().trim().regex(axesDataSchema),
    correlationid: z.string().trim().min(1).max(160),
    idempotencykey: z.string().trim().min(1).max(300),
    axesrunid: z.string().trim().min(1).max(160),
    axesscenarioid: z.string().trim().min(1).max(160),
    axesscenarioversion: z.string().trim().regex(semanticVersion),
    axesseed: z.string().trim().min(1).max(300),
    axessequence: z.number().int().positive(),
    axessimulated: z.literal(true),
    data: z.record(z.string(), jsonValueSchema),
  })
  .strict();

export type CanonicalEvent = z.infer<typeof canonicalEventSchema>;
