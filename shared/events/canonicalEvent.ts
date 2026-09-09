import { z } from "zod";

const axesEventType =
  /^com\.axesistemas\.[a-z0-9]+(?:[.-][a-z0-9]+)*\.v[1-9][0-9]*$/;
const axesDataSchema =
  /^urn:axesistemas:schema:[a-z0-9]+(?::[a-z0-9-]+)*:[1-9][0-9]*\.[0-9]+\.[0-9]+$/;
const semanticVersion = /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/;

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
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export type CanonicalEvent = z.infer<typeof canonicalEventSchema>;
