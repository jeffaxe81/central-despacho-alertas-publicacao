import { createHmac, randomUUID } from "node:crypto";

const endpoint = process.env.AXE_URL ?? "https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events";
const apiKey = process.env.AXE_API_KEY;
const hmacSecret = process.env.AXE_HMAC_SECRET;

if (!apiKey || !hmacSecret) {
  throw new Error("Defina AXE_API_KEY e AXE_HMAC_SECRET no ambiente antes de executar.");
}

const timestamp = new Date().toISOString();
const externalId = process.env.ALERT_EXTERNAL_ID ?? `demo-${Date.now()}`;
const correlationId = randomUUID();
const payload = {
  schemaVersion: "1.0",
  eventId: `evt_alrt_${randomUUID()}`,
  eventType: "alert.received",
  occurredAt: timestamp,
  source: { system: "despacho-alrt", environment: "homologacao" },
  correlationId,
  idempotencyKey: `alrt:alert:${externalId}:v1`,
  data: {
    alert: {
      externalId,
      category: "Alerta urbano",
      priority: "alta",
      description: "Alerta de homologação assinado pelo ALRT.",
      address: "Rua de Homologação, nº 100",
      latitude: -27.0976,
      longitude: -48.9104,
      reportedAt: timestamp,
      sourceStatus: "novo",
    },
  },
};

// Não reformate nem gere novamente o JSON depois desta linha: estes bytes são assinados e enviados.
const rawBody = JSON.stringify(payload);
const signature = `sha256=${createHmac("sha256", hmacSecret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex")}`;
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-alrt-api-key": apiKey,
      "x-timestamp": timestamp,
      "x-request-timestamp": timestamp,
      "x-correlation-id": correlationId,
      "x-signature": signature,
    },
    body: rawBody,
    signal: controller.signal,
  });
  const responseBody = await response.text();
  console.log(JSON.stringify({ status: response.status, correlationId, response: responseBody }, null, 2));
  process.exitCode = response.ok ? 0 : 1;
} finally {
  clearTimeout(timeout);
}
