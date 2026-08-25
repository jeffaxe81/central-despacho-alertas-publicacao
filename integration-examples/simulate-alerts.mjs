const targetUrl = process.env.ALERT_TARGET_URL ?? "http://127.0.0.1:8787/api/integrations/occurrences";
const shouldSend = process.argv.includes("--send");
const countArgument = process.argv.find(argument => argument.startsWith("--count="));
const count = Math.max(1, Math.min(50, Number(countArgument?.split("=")[1] ?? 3)));
const allowNonLocal = process.env.ALLOW_NON_LOCAL_TEST_TARGET === "true";

const eventDefinitions = [
  { type: "PUBLIC_LIGHTING", priority: "MEDIUM", title: "Falha em iluminação pública", narrative: "Luminária intermitente em via pública, reduzindo a visibilidade de pedestres." },
  { type: "MUNICIPAL_SECURITY", priority: "HIGH", title: "Solicitação de segurança municipal", narrative: "Solicitação de averiguação preventiva em espaço público." },
  { type: "CIVIL_DEFENSE", priority: "HIGH", title: "Alerta de defesa civil", narrative: "Condição de risco preventivo identificada, requerendo vistoria técnica." },
  { type: "TRAFFIC_LIGHT", priority: "HIGH", title: "Falha em semáforo", narrative: "Sinaleira apagada, com impacto no fluxo do cruzamento." },
  { type: "CAMERA", priority: "MEDIUM", title: "Câmera indisponível", narrative: "Câmera de monitoramento sem comunicação no ponto informado." },
  { type: "PANIC_BUTTON", priority: "CRITICAL", title: "Botão de perigo acionado", narrative: "Acionamento preventivo de botão de perigo, requerendo verificação imediata." },
];

function buildAlert(index) {
  const event = eventDefinitions[index % eventDefinitions.length];
  const id = `SIM-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${String(index + 1).padStart(3, "0")}`;
  return {
    schemaVersion: "1.0",
    id,
    code: `URB-${event.type}-${String(index + 1).padStart(6, "0")}`,
    priority: event.priority,
    status: "NEW",
    createdAt: new Date().toISOString(),
    eventType: event.type,
    title: event.title,
    narrative: event.narrative,
    location: { address: `Rua de Teste, nº ${100 + index}`, neighborhood: "Ambiente de Teste", latitude: -15.793889 + index * 0.0005, longitude: -47.882778 + index * 0.0005 },
    source: { system: "central-despacho-alertas", mode: "test", correlationId: id },
  };
}

const parsedTarget = new URL(targetUrl);
if (parsedTarget.hostname !== "127.0.0.1" && parsedTarget.hostname !== "localhost" && !allowNonLocal) {
  throw new Error("Por segurança, o simulador só envia para localhost. Para um ambiente externo de testes, defina ALLOW_NON_LOCAL_TEST_TARGET=true de forma explícita.");
}

const alerts = Array.from({ length: count }, (_, index) => buildAlert(index));
if (!shouldSend) {
  console.log(JSON.stringify({ mode: "dry-run", targetUrl, alerts }, null, 2));
  console.log("Nenhuma requisição foi enviada. Para enviar ao mock local, execute novamente com --send.");
} else {
  const responses = await Promise.all(alerts.map(async alert => {
    const response = await fetch(targetUrl, { method: "POST", headers: { "content-type": "application/json", "x-alert-source": "simulation" }, body: JSON.stringify(alert) });
    return { id: alert.id, status: response.status, body: await response.json() };
  }));
  console.table(responses.map(item => ({ id: item.id, status: item.status, accepted: item.body.accepted })));
}
