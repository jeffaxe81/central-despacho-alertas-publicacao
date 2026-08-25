import { CoordinatePicker, type Coordinates } from "@/components/CoordinatePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, MapPinned, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function IntegrationExample() {
  const [coordinates, setCoordinates] = useState<Coordinates>({ latitude: -15.793889, longitude: -47.882778 });
  const payload = useMemo(() => ({
    schemaVersion: "1.0",
    id: "SIM-EXEMPLO-000001",
    code: "URB-SEM-000001",
    priority: "HIGH",
    status: "NEW",
    createdAt: "2026-08-22T12:30:00.000Z",
    eventType: "TRAFFIC_LIGHT",
    title: "Falha em semáforo",
    narrative: "Sinaleira apagada em via pública, com impacto no fluxo do cruzamento.",
    location: { address: "Rua das Flores, nº 142", neighborhood: "Centro", latitude: coordinates.latitude, longitude: coordinates.longitude },
    source: { system: "central-despacho-alertas", mode: "test", correlationId: "SIM-EXEMPLO-000001" },
  }), [coordinates]);

  const copyPayload = async () => {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success("Payload copiado para a área de transferência.");
  };

  return <main className="min-h-screen bg-[#07111d] p-4 text-slate-100 md:p-8"><div className="mx-auto max-w-5xl space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-cyan-300"><MapPinned className="h-4 w-4" />Exemplo executável</div><h1 className="text-3xl font-semibold">Selecionar coordenadas do alerta</h1><p className="mt-2 max-w-2xl text-slate-400">Clique no mapa, arraste o marcador ou informe latitude e longitude. O painel abaixo reflete exatamente o JSON que seria enviado ao receptor REST.</p></div><Badge variant="outline" className="w-fit border-amber-300/30 bg-amber-300/10 text-amber-200">Sem envio externo</Badge></div><CoordinatePicker value={coordinates} onChange={setCoordinates} /><Card className="border-slate-700 bg-[#0c1b2b]"><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle className="text-slate-100">Payload proposto</CardTitle><CardDescription className="mt-1 text-slate-400">Destino recomendado: <code>POST /api/integrations/occurrences</code>.</CardDescription></div><Button type="button" onClick={copyPayload} variant="outline" className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"><Copy className="mr-2 h-4 w-4" />Copiar JSON</Button></div></CardHeader><CardContent><pre className="max-h-[460px] overflow-auto rounded-xl border border-slate-800 bg-[#07111d] p-4 text-xs leading-5 text-cyan-100">{JSON.stringify(payload, null, 2)}</pre><div className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Send className="h-4 w-4 text-cyan-300" />Use o script <code className="text-cyan-200">simulate-alerts.mjs</code> para validar o receptor local antes de enviar a um ambiente externo.</div></CardContent></Card></div></main>;
}
