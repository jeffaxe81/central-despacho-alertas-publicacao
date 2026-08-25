export const WORKFLOW_RECEIVER_URL = "https://despachoalrt-hjwc4f8q.manus.space/api/integrations/occurrences";

export const WORKFLOW_REQUIRED_HEADERS = [
  { name: "Content-Type", value: "application/json" },
  { name: "x-api-key", value: "API key gerada e salva na categoria da central" },
] as const;

export const WORKFLOW_CONFIGURATION_STEPS = [
  "No Dispatch App, crie uma etapa HTTP com método POST.",
  "Cole o endpoint da Central de Alertas e informe os dois headers obrigatórios.",
  "Use a API key gerada na configuração da categoria receptora; ela não é exibida novamente após ser salva.",
  "Envie o payload do perfil AXE e confirme o registro na tabela de resultados desta aba.",
] as const;
