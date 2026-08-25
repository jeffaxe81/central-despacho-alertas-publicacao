export const EVENT_CATEGORIES = [
  { key: "iluminacao_publica", label: "Iluminação pública", color: "amber" },
  { key: "seguranca_municipal", label: "Segurança pública municipal", color: "rose" },
  { key: "defesa_civil", label: "Defesa civil", color: "orange" },
  { key: "semaforos", label: "Semáforos", color: "sky" },
  { key: "cameras", label: "Câmeras", color: "violet" },
  { key: "botao_perigo", label: "Botão de perigo", color: "red" },
] as const;

export const SEVERITY_OPTIONS = ["baixa", "media", "alta", "critica"] as const;
export const DELIVERY_STATUS_OPTIONS = ["pendente", "sucesso", "falha"] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number]["key"];
export type Severity = (typeof SEVERITY_OPTIONS)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUS_OPTIONS)[number];

export const DEFAULT_PAYLOAD_TEMPLATE = JSON.stringify(
  {
    eventId: "{{alertId}}",
    categoria: "{{category}}",
    tipo: "{{eventName}}",
    severidade: "{{severity}}",
    timestamp: "{{timestamp}}",
    endereco: "{{address}}",
    bairro: "{{neighborhood}}",
    latitude: "{{latitude}}",
    longitude: "{{longitude}}",
    coordenadas: "{{coordinates}}",
    narrativa: "{{narrative}}",
    simulacao: true,
  },
  null,
  2
);

export const AXE_DISPATCH_PAYLOAD_TEMPLATE = JSON.stringify(
  {
    schemaVersion: "1.0",
    id: "{{alertId}}",
    code: "URB-{{category}}-{{alertId}}",
    priority: "{{axePriority}}",
    status: "NEW",
    createdAt: "{{timestamp}}",
    eventType: "{{category}}",
    title: "{{eventName}}",
    narrative: "{{narrative}}",
    location: {
      address: "{{address}}",
      neighborhood: "{{neighborhood}}",
      latitude: "{{latitude}}",
      longitude: "{{longitude}}",
    },
    source: {
      system: "central-despacho-alertas",
      mode: "{{isTestMode}}",
      correlationId: "{{alertId}}",
    },
  },
  null,
  2
);

export const ALRT_AXE_INGRESS_PAYLOAD_TEMPLATE = `{
  "schemaVersion": "1.0",
  "eventId": "evt_{{alertId}}",
  "eventType": "alert.received",
  "occurredAt": "{{timestamp}}",
  "source": {
    "system": "despacho-alrt",
    "environment": "homologacao"
  },
  "correlationId": "{{correlationId}}",
  "idempotencyKey": "alrt:alert:{{alertId}}:created:v1",
  "data": {
    "alert": {
      "externalId": "{{alertId}}",
      "category": "{{eventName}}",
      "priority": "{{severity}}",
      "description": "{{narrative}}",
      "address": "{{address}}",
      "latitude": {{latitude}},
      "longitude": {{longitude}},
      "reportedAt": "{{timestamp}}",
      "sourceStatus": "novo"
    }
  }
}`;

export const DEFAULT_EVENT_SETTINGS: Record<
  EventCategory,
  { description: string; severity: Severity }
> = {
  iluminacao_publica: {
    description: "Irregularidade na iluminação urbana que requer vistoria.",
    severity: "media",
  },
  seguranca_municipal: {
    description: "Ocorrência de segurança urbana que requer atenção da equipe municipal.",
    severity: "alta",
  },
  defesa_civil: {
    description: "Situação preventiva de defesa civil identificada em área urbana.",
    severity: "alta",
  },
  semaforos: {
    description: "Falha operacional em equipamento semafórico.",
    severity: "alta",
  },
  cameras: {
    description: "Indisponibilidade de equipamento de videomonitoramento.",
    severity: "media",
  },
  botao_perigo: {
    description: "Acionamento preventivo do botão de perigo.",
    severity: "critica",
  },
};

export const DEFAULT_SIMULATION_COORDINATES = {
  latitude: -15.793889,
  longitude: -47.882778,
};
