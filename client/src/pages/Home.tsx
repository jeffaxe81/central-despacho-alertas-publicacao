import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CoordinatePicker, normalizeCoordinates, type Coordinates } from "@/components/CoordinatePicker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { generateIntegrationApiKey } from "@/lib/apiKey";
import { applyAlrtAxeProfile } from "@/lib/alrtAxeProfile";
import { WORKFLOW_CONFIGURATION_STEPS, WORKFLOW_RECEIVER_URL, WORKFLOW_REQUIRED_HEADERS } from "@/lib/workflowIntegration";
import { AXE_DISPATCH_PAYLOAD_TEMPLATE, DEFAULT_PAYLOAD_TEMPLATE, EVENT_CATEGORIES, SEVERITY_OPTIONS, type EventCategory, type Severity } from "@shared/alertSimulation";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Copy, Eye, Gauge, Loader2, LocateFixed, MapPin, Play, RadioTower, RefreshCw, Search, Send, Settings2, ShieldAlert, Sparkles, TriangleAlert, WifiOff } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type SafeAlertType = {
  id: number;
  category: EventCategory;
  name: string;
  defaultDescription: string;
  defaultSeverity: Severity;
  endpointUrl: string;
  headersJson: string;
  payloadTemplate: string;
  apiKeyHeader: string;
  isTestMode: boolean;
  autoEnabled: boolean;
  autoIntervalMinutes: number;
  defaultLatitude: number;
  defaultLongitude: number;
  useGeneralLocation: boolean;
  hasAuthToken: boolean;
  hasApiKey: boolean;
};

export type ConfigDraft = SafeAlertType & { authToken: string; clearToken: boolean; apiKey: string; clearApiKey: boolean };

const categoryMeta = Object.fromEntries(EVENT_CATEGORIES.map(category => [category.key, category]));

const severityStyle: Record<Severity, string> = {
  baixa: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  media: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  alta: "border-orange-400/25 bg-orange-400/10 text-orange-200",
  critica: "border-rose-400/25 bg-rose-400/10 text-rose-200",
};

const statusStyle: Record<string, string> = {
  sucesso: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  falha: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  pendente: "border-amber-400/25 bg-amber-400/10 text-amber-200",
};

const workflowOutcomeStyle: Record<string, string> = {
  accepted: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  duplicate: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  invalid: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  unauthorized: "border-rose-400/25 bg-rose-400/10 text-rose-200",
};

function toDraft(alertType: SafeAlertType): ConfigDraft {
  return { ...alertType, authToken: "", clearToken: false, apiKey: "", clearApiKey: false };
}

function timeLabel(value: Date | string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  const [location, setLocation] = useLocation();
  const view = location === "/workflow" ? "workflow" : location === "/historico" ? "historico" : location === "/configuracoes" ? "configuracoes" : location === "/eventos" ? "eventos" : "painel";
  const showAlrtAxeProfilePreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("profilePreview") === "alrt-axe";
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<SafeAlertType | null>(null);
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const [autoInterval, setAutoInterval] = useState("15");
  const [simulatorCoordinates, setSimulatorCoordinates] = useState<Coordinates>({ latitude: -15.793889, longitude: -47.882778 });

  const typesQuery = trpc.alerts.eventTypes.useQuery();
  const historyQuery = trpc.alerts.history.useQuery({ limit: 80 });
  const workflowQuery = trpc.alerts.workflowMonitor.useQuery({ limit: 80 });
  const metricsQuery = trpc.alerts.metrics.useQuery();
  const generalSettingsQuery = trpc.alerts.generalSettings.useQuery();
  const updateGeneralSettingsMutation = trpc.alerts.updateGeneralSettings.useMutation({
    onSuccess: settings => {
      const coordinates = { latitude: settings.defaultLatitude, longitude: settings.defaultLongitude };
      setSimulatorCoordinates(coordinates);
      toast.success("Coordenadas gerais salvas", { description: "O simulador passará a iniciar nesta localização padrão." });
      void generalSettingsQuery.refetch();
    },
    onError: error => toast.error("Não foi possível salvar as coordenadas gerais", { description: error.message }),
  });
  const geocodeAddressMutation = trpc.alerts.geocodeAddress.useMutation();
  const resetGeneratedDataMutation = trpc.alerts.resetGeneratedData.useMutation({
    onSuccess: result => {
      toast.success("Dados gerados removidos", { description: `${result.dispatchedAlerts} alertas, ${result.workflowOccurrences} ocorrências e ${result.workflowLogs} logs foram limpos.` });
      void utils.alerts.history.invalidate();
      void utils.alerts.workflowMonitor.invalidate();
      void utils.alerts.metrics.invalidate();
    },
    onError: error => toast.error("Não foi possível resetar os dados gerados", { description: error.message }),
  });
  const dispatchMutation = trpc.alerts.dispatch.useMutation({
    onSuccess: result => {
      const title = result.ok ? "Alerta entregue" : "Alerta não entregue";
      toast[result.ok ? "success" : "error"](title, {
        description: result.ok
          ? `${result.occurrence.narrative} — HTTP ${result.status ?? 202}.`
          : result.failureReason || "Verifique a configuração do endpoint.",
      });
      void utils.alerts.history.invalidate();
      void utils.alerts.metrics.invalidate();
    },
    onError: error => toast.error("Não foi possível gerar o alerta", { description: error.message }),
  });
  const updateMutation = trpc.alerts.updateEventType.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva", { description: "O próximo disparo utilizará os novos parâmetros." });
      setSelected(null);
      void utils.alerts.eventTypes.invalidate();
    },
    onError: error => toast.error("Configuração inválida", { description: error.message }),
  });
  const automationMutation = trpc.alerts.configureAutomation.useMutation({
    onSuccess: () => {
      toast.success("Automação atualizada", { description: "A programação será efetivada após a publicação do projeto." });
      void utils.alerts.eventTypes.invalidate();
    },
    onError: error => toast.error("Não foi possível configurar a automação", { description: error.message }),
  });

  useEffect(() => {
    if (selected) {
      setDraft(toDraft(selected));
      setAutoInterval(String(selected.autoIntervalMinutes));
    }
  }, [selected]);

  const alertTypes = (typesQuery.data ?? []) as SafeAlertType[];
  const history = historyQuery.data ?? [];
  const metrics = metricsQuery.data ?? [];
  useEffect(() => {
    if (!generalSettingsQuery.data) return;
    setSimulatorCoordinates({ latitude: generalSettingsQuery.data.defaultLatitude, longitude: generalSettingsQuery.data.defaultLongitude });
  }, [generalSettingsQuery.data?.defaultLatitude, generalSettingsQuery.data?.defaultLongitude]);
  const previewItem = showAlrtAxeProfilePreview && view === "configuracoes" ? alertTypes[0] ?? null : null;
  const dialogSelected = selected ?? previewItem;
  const dialogDraft = draft ?? (previewItem ? applyAlrtAxeProfile(toDraft(previewItem)) : null);
  const totals = useMemo(() => {
    const total = metrics.reduce((sum, item) => sum + Number(item.total), 0);
    const success = metrics.filter(item => item.status === "sucesso").reduce((sum, item) => sum + Number(item.total), 0);
    const failed = metrics.filter(item => item.status === "falha").reduce((sum, item) => sum + Number(item.total), 0);
    return { total, success, failed, rate: total ? Math.round((success / total) * 100) : 0 };
  }, [metrics]);

  const saveDraft = () => {
    if (!draft) return;
    updateMutation.mutate({
      id: draft.id,
      name: draft.name,
      defaultDescription: draft.defaultDescription,
      defaultSeverity: draft.defaultSeverity,
      endpointUrl: draft.endpointUrl,
      headersJson: draft.headersJson,
      authToken: draft.clearToken ? "" : draft.authToken || undefined,
      apiKey: draft.clearApiKey ? "" : draft.apiKey || undefined,
      apiKeyHeader: draft.apiKeyHeader,
      payloadTemplate: draft.payloadTemplate,
      isTestMode: draft.isTestMode,
      defaultLatitude: draft.defaultLatitude,
      defaultLongitude: draft.defaultLongitude,
      useGeneralLocation: draft.useGeneralLocation,
    });
  };

  const toggleAutomation = (item: SafeAlertType) => {
    const intervalMinutes = Number(item.id === selected?.id ? autoInterval : item.autoIntervalMinutes);
    automationMutation.mutate({ id: item.id, enabled: !item.autoEnabled, intervalMinutes });
  };

  const copyNarrative = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Narrativa copiada");
  };

  const isLoading = typesQuery.isLoading || historyQuery.isLoading || workflowQuery.isLoading || metricsQuery.isLoading || generalSettingsQuery.isLoading;

  return (
    <div className="min-h-full bg-[#07121f] text-slate-100">
      <header className="relative overflow-hidden rounded-2xl border border-cyan-300/10 bg-[#0a1a2a] px-5 py-6 shadow-2xl shadow-slate-950/30 sm:px-8">
        <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-24 bottom-0 h-px w-2/5 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              <RadioTower className="h-4 w-4" />
              Simulação de despacho urbano
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Central de Alertas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Gere ocorrências fictícias contextualizadas, valide a integração e monitore cada entrega sem depender da central real.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="h-8 border-cyan-300/20 bg-cyan-300/5 px-3 text-cyan-200">Modo seguro: dados simulados</Badge>
            <Badge variant="outline" className="h-8 border-emerald-300/20 bg-emerald-300/5 px-3 text-emerald-200"><span className="mr-2 h-2 w-2 rounded-full bg-emerald-300" />Motor disponível</Badge>
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          ["painel", "/", "Visão geral"],
          ["eventos", "/eventos", "Simular alertas"],
          ["historico", "/historico", "Histórico"],
          ["workflow", "/workflow", "Workflow"],
          ["configuracoes", "/configuracoes", "Integrações"],
        ].map(([key, path, label]) => (
          <Button key={key} variant={view === key ? "default" : "ghost"} onClick={() => setLocation(path)} className={view === key ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}>{label}</Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-300" /></div>
      ) : (
        <main className="py-6">
          {view === "painel" && <DashboardView totals={totals} metrics={metrics} alertTypes={alertTypes} onDispatch={id => dispatchMutation.mutate({ id })} onConfig={setSelected} isDispatching={dispatchMutation.isPending} />}
          {view === "eventos" && <SimulatorView alertTypes={alertTypes} coordinates={simulatorCoordinates} onCoordinatesChange={setSimulatorCoordinates} onDispatch={(id, coordinates) => dispatchMutation.mutate({ id, ...coordinates })} onConfig={setSelected} isDispatching={dispatchMutation.isPending} />}
          {view === "historico" && <HistoryView history={history} onCopy={copyNarrative} onRefresh={() => { void historyQuery.refetch(); void metricsQuery.refetch(); }} />}
          {view === "workflow" && <WorkflowView monitor={workflowQuery.data ?? { occurrences: [], logs: [] }} onRefresh={() => void workflowQuery.refetch()} />}
          {view === "configuracoes" && <div className="space-y-6"><GeneralSettingsView coordinates={generalSettingsQuery.data ? { latitude: generalSettingsQuery.data.defaultLatitude, longitude: generalSettingsQuery.data.defaultLongitude } : simulatorCoordinates} onSave={(coordinates: Coordinates) => updateGeneralSettingsMutation.mutate({ defaultLatitude: coordinates.latitude, defaultLongitude: coordinates.longitude })} onSearchAddress={async address => { const result = await geocodeAddressMutation.mutateAsync({ address }); return { latitude: result.latitude, longitude: result.longitude, formattedAddress: result.formattedAddress }; }} isSaving={updateGeneralSettingsMutation.isPending} isSearching={geocodeAddressMutation.isPending} /><ResetGeneratedDataPanel onReset={() => resetGeneratedDataMutation.mutate({ confirmation: "LIMPAR DADOS GERADOS" })} isResetting={resetGeneratedDataMutation.isPending} /><IntegrationView alertTypes={alertTypes} onConfig={setSelected} onToggleAutomation={toggleAutomation} isSaving={automationMutation.isPending} /><AxeReadinessPanel alertTypes={alertTypes} /></div>}
        </main>
      )}

      <Dialog open={Boolean(dialogSelected && dialogDraft)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-700 bg-[#0d1e30] text-slate-100 sm:max-w-3xl">
          {dialogDraft && dialogSelected && <EventConfigDialog draft={dialogDraft} setDraft={setDraft} onSave={saveDraft} isSaving={updateMutation.isPending} autoInterval={autoInterval} setAutoInterval={setAutoInterval} onAutomation={() => toggleAutomation(dialogSelected)} automationSaving={automationMutation.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DashboardView({ totals, metrics, alertTypes, onDispatch, onConfig, isDispatching }: { totals: { total: number; success: number; failed: number; rate: number }; metrics: { category: EventCategory; status: string; total: number }[]; alertTypes: SafeAlertType[]; onDispatch: (id: number) => void; onConfig: (item: SafeAlertType) => void; isDispatching: boolean }) {
  const statCards = [
    { label: "Alertas nas últimas 24h", value: totals.total, icon: ActivityIcon, accent: "text-cyan-300" },
    { label: "Entregas confirmadas", value: totals.success, icon: CheckCircle2, accent: "text-emerald-300" },
    { label: "Falhas de entrega", value: totals.failed, icon: WifiOff, accent: "text-rose-300" },
    { label: "Taxa de sucesso", value: `${totals.rate}%`, icon: Gauge, accent: "text-violet-300" },
  ];
  return <div className="space-y-6">
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {statCards.map(stat => <Card key={stat.label} className="border-slate-800 bg-[#0c1b2b] shadow-none"><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">{stat.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-white">{stat.value}</p></div><div className={`rounded-xl bg-slate-900 p-2.5 ${stat.accent}`}><stat.icon className="h-5 w-5" /></div></CardContent></Card>)}
    </section>
    <section className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
      <Card className="border-slate-800 bg-[#0c1b2b] shadow-none"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-base text-slate-100">Volume por categoria</CardTitle><CardDescription className="mt-1 text-slate-500">Entregas registradas nas últimas 24 horas.</CardDescription></div><Badge variant="outline" className="border-slate-700 text-slate-400">janela móvel</Badge></div></CardHeader><CardContent className="space-y-4">
        {EVENT_CATEGORIES.map(category => { const total = metrics.filter(item => item.category === category.key).reduce((sum, item) => sum + Number(item.total), 0); const percent = totals.total ? Math.round((total / totals.total) * 100) : 0; return <div key={category.key}><div className="mb-2 flex justify-between text-sm"><span className="text-slate-300">{category.label}</span><span className="font-medium text-slate-400">{total} <span className="text-slate-600">/ {percent}%</span></span></div><Progress value={percent} className="h-2 bg-slate-800 [&>div]:bg-cyan-400" /></div> })}
      </CardContent></Card>
      <Card className="border-cyan-300/15 bg-gradient-to-b from-cyan-300/[0.07] to-[#0c1b2b] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><Sparkles className="h-4 w-4 text-cyan-300" />Pronto para simular</CardTitle><CardDescription className="text-slate-400">Cada categoria possui narrativa e payload próprios.</CardDescription></CardHeader><CardContent><div className="space-y-3">{alertTypes.slice(0, 3).map(item => <button key={item.id} onClick={() => onDispatch(item.id)} disabled={isDispatching} className="flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-slate-950/40 p-3 text-left transition-colors hover:border-cyan-300/30 hover:bg-cyan-300/5 disabled:opacity-50"><span className="text-sm text-slate-200">{item.name}</span><Send className="h-4 w-4 text-cyan-300" /></button>)}</div><Button onClick={() => onConfig(alertTypes[0]!)} variant="outline" className="mt-5 w-full border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800">Ajustar configuração</Button></CardContent></Card>
    </section>
    <Card className="border-slate-800 bg-[#0c1b2b] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-100"><ShieldAlert className="h-4 w-4 text-cyan-300" />Matriz de entrega por categoria</CardTitle><CardDescription className="text-slate-500">Sucesso, falha e pendência registrados na janela de 24 horas.</CardDescription></CardHeader><CardContent className="space-y-2">{EVENT_CATEGORIES.map(category => { const statusCount = (status: string) => metrics.find(item => item.category === category.key && item.status === status)?.total ?? 0; return <div key={category.key} className="flex flex-col gap-2 rounded-lg border border-slate-800/80 bg-slate-950/25 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm font-medium text-slate-300">{category.label}</span><div className="grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded bg-emerald-400/10 px-2 py-1 text-emerald-300"><b className="mr-1">S</b>{statusCount("sucesso")}</span><span className="rounded bg-rose-400/10 px-2 py-1 text-rose-300"><b className="mr-1">F</b>{statusCount("falha")}</span><span className="rounded bg-amber-400/10 px-2 py-1 text-amber-200"><b className="mr-1">P</b>{statusCount("pendente")}</span></div></div> })}</CardContent></Card>
  </div>;
}

function SimulatorView({ alertTypes, coordinates, onCoordinatesChange, onDispatch, onConfig, isDispatching }: { alertTypes: SafeAlertType[]; coordinates: Coordinates; onCoordinatesChange: (coordinates: Coordinates) => void; onDispatch: (id: number, coordinates: Coordinates) => void; onConfig: (item: SafeAlertType) => void; isDispatching: boolean }) {
  return <div className="space-y-6"><div><h2 className="text-xl font-semibold text-white">Simulador de eventos</h2><p className="mt-1 text-sm text-slate-400">Escolha no mapa a posição do próximo alerta e dispare a categoria desejada.</p></div><CoordinatePicker value={coordinates} onChange={onCoordinatesChange} /><div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] px-4 py-3 text-sm"><MapPin className="h-4 w-4 text-cyan-300" /><span className="text-slate-400">Próximo alerta:</span><span className="font-medium text-cyan-100">{coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}</span><span className="text-slate-500">Essas coordenadas serão incluídas no payload REST.</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{alertTypes.map(item => <Card key={item.id} className="group relative overflow-hidden border-slate-800 bg-[#0c1b2b] shadow-none"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" /><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><span className="h-2 w-2 rounded-full bg-cyan-300" />{categoryMeta[item.category].label}</div><CardTitle className="text-base text-slate-100">{item.name}</CardTitle></div><Badge variant="outline" className={severityStyle[item.defaultSeverity]}>{item.defaultSeverity}</Badge></div><CardDescription className="line-clamp-2 min-h-10 text-slate-500">{item.defaultDescription}</CardDescription></CardHeader><CardContent><div className="mb-4 flex items-center justify-between rounded-lg bg-slate-950/50 px-3 py-2 text-xs"><span className="text-slate-500">Destino</span><span className={item.isTestMode ? "font-medium text-emerald-300" : "font-medium text-amber-200"}>{item.isTestMode ? "Mock interno" : "REST externo"}</span></div><div className="flex gap-2"><Button onClick={() => onDispatch(item.id, coordinates)} disabled={isDispatching} className="flex-1 bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Play className="mr-2 h-4 w-4 fill-current" />Disparar</Button><Button onClick={() => onConfig(item)} variant="outline" size="icon" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"><Settings2 className="h-4 w-4" /></Button></div></CardContent></Card>)}</div></div>;
}

function HistoryView({ history, onCopy, onRefresh }: { history: any[]; onCopy: (text: string) => void; onRefresh: () => void }) {
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><h2 className="text-xl font-semibold text-white">Histórico de entregas</h2><p className="mt-1 text-sm text-slate-400">Registro imutável do payload, resposta, narrativa e localização de cada simulação.</p></div><Button onClick={onRefresh} variant="outline" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></div><Card className="overflow-hidden border-slate-800 bg-[#0c1b2b] shadow-none"><Table><TableHeader><TableRow className="border-slate-800 hover:bg-transparent"><TableHead className="text-slate-500">Registro</TableHead><TableHead className="text-slate-500">Ocorrência</TableHead><TableHead className="text-slate-500">Entrega</TableHead><TableHead className="text-right text-slate-500">Ação</TableHead></TableRow></TableHeader><TableBody>{history.length ? history.map(item => <TableRow key={item.id} className="border-slate-800/80 hover:bg-slate-800/30"><TableCell className="align-top"><p className="text-sm text-slate-200">{timeLabel(item.sentAt)}</p><p className="mt-1 text-xs text-slate-600">#{item.id} · {item.eventName}</p></TableCell><TableCell className="max-w-md align-top"><p className="font-medium text-slate-200">{item.address}</p><p className="mt-1 text-xs font-medium text-cyan-300">{Number(item.latitude).toFixed(6)}, {Number(item.longitude).toFixed(6)}</p><p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{item.narrative}</p></TableCell><TableCell className="align-top"><Badge variant="outline" className={statusStyle[item.status]}>{item.status}</Badge><p className="mt-2 text-xs text-slate-500">{item.responseHttpStatus ? `HTTP ${item.responseHttpStatus}` : item.failureReason || "Aguardando resposta"}</p></TableCell><TableCell className="text-right align-top"><Button onClick={() => onCopy(item.narrative)} variant="ghost" size="icon" className="text-slate-400 hover:bg-slate-800 hover:text-cyan-200"><Copy className="h-4 w-4" /></Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="h-48 text-center text-slate-500"><Clock3 className="mx-auto mb-3 h-6 w-6" />Nenhum alerta enviado ainda. Use o simulador para iniciar.</TableCell></TableRow>}</TableBody></Table></Card></div>;
}

export function GeneralSettingsView({ coordinates, onSave, onSearchAddress, isSaving, isSearching }: { coordinates: Coordinates; onSave: (coordinates: Coordinates) => void; onSearchAddress: (address: string) => Promise<{ latitude: number; longitude: number; formattedAddress: string }>; isSaving: boolean; isSearching: boolean }) {
  const [draft, setDraft] = useState<Coordinates>(coordinates);
  const [addressQuery, setAddressQuery] = useState("");

  useEffect(() => {
    setDraft(coordinates);
  }, [coordinates.latitude, coordinates.longitude]);

  const searchAddress = async () => {
    if (addressQuery.trim().length < 5) return toast.error("Informe um endereço mais completo para pesquisar.");
    try {
      const result = await onSearchAddress(addressQuery);
      setDraft(normalizeCoordinates({ latitude: result.latitude, longitude: result.longitude }));
      setAddressQuery(result.formattedAddress);
      toast.success("Endereço localizado", { description: result.formattedAddress });
    } catch (error) {
      toast.error("Não foi possível localizar o endereço", { description: error instanceof Error ? error.message : "Tente informar rua, cidade e UF." });
    }
  };

  const captureBrowserLocation = () => {
    if (!navigator.geolocation) return toast.error("Seu navegador não disponibiliza geolocalização.");
    navigator.geolocation.getCurrentPosition(position => {
      setDraft(normalizeCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude }));
      toast.success("Localização atual capturada", { description: "Confira a posição no mapa e salve quando estiver pronto." });
    }, error => toast.error("Não foi possível capturar sua localização", { description: error.message || "Verifique a permissão do navegador." }), { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 });
  };

  return <Card className="border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.08] to-[#0c1b2b] shadow-none"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-base text-cyan-100"><MapPin className="h-4 w-4" />Configurações gerais de localização</CardTitle><CardDescription className="mt-1 max-w-2xl text-slate-400">Defina a latitude e longitude padrão da Central. O simulador será iniciado nesta posição sempre que não houver uma seleção temporária.</CardDescription></div><Badge variant="outline" className="w-fit border-cyan-300/30 bg-cyan-300/10 text-cyan-200">Padrão do simulador</Badge></div></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-slate-700 bg-slate-950/35 p-3"><p className="text-xs uppercase tracking-wider text-slate-500">Latitude padrão</p><p className="mt-1 font-mono text-lg text-cyan-100">{draft.latitude.toFixed(6)}</p></div><div className="rounded-lg border border-slate-700 bg-slate-950/35 p-3"><p className="text-xs uppercase tracking-wider text-slate-500">Longitude padrão</p><p className="mt-1 font-mono text-lg text-cyan-100">{draft.longitude.toFixed(6)}</p></div></div><div className="grid gap-3 rounded-xl border border-slate-700 bg-slate-950/25 p-4 lg:grid-cols-[1fr,auto,auto]"><div className="space-y-2"><Label htmlFor="general-address-search" className="text-slate-300">Buscar endereço</Label><Input id="general-address-search" value={addressQuery} onChange={event => setAddressQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void searchAddress(); } }} placeholder="Ex.: Praça dos Três Poderes, Brasília - DF" className="border-slate-700 bg-slate-950/40 text-slate-100" /></div><Button type="button" onClick={() => void searchAddress()} disabled={isSearching} variant="outline" className="self-end border-cyan-300/25 bg-cyan-300/5 text-cyan-200 hover:bg-cyan-300/10">{isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Buscar</Button><Button type="button" onClick={captureBrowserLocation} variant="outline" className="self-end border-emerald-300/25 bg-emerald-300/5 text-emerald-200 hover:bg-emerald-300/10"><LocateFixed className="mr-2 h-4 w-4" />Usar minha localização</Button></div><CoordinatePicker value={draft} onChange={setDraft} title="Localização padrão da Central" description="Clique no mapa, arraste o marcador ou use a busca de endereço e sua localização atual para definir a origem padrão dos próximos alertas simulados." markerTitle="Coordenada padrão da Central" /><div className="flex flex-col gap-3 border-t border-slate-700 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-xs leading-5 text-slate-500">As coordenadas específicas selecionadas no simulador continuam tendo prioridade para um único alerta. Categorias marcadas como localização própria também não são alteradas por esta configuração.</p><Button onClick={() => onSave(draft)} disabled={isSaving} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar localização padrão</Button></div></CardContent></Card>;
}

export function ResetGeneratedDataPanel({ onReset, isResetting }: { onReset: () => void; isResetting: boolean }) {
  const [confirmation, setConfirmation] = useState("");
  const ready = confirmation === "LIMPAR DADOS GERADOS";

  return <Card className="border-rose-300/20 bg-rose-300/[0.04] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-rose-100"><AlertTriangle className="h-4 w-4" />Resetar dados gerados</CardTitle><CardDescription className="text-slate-400">Remove dados de simulação e auditoria acumulados, sem alterar a configuração operacional da Central.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-3xl text-sm leading-6 text-slate-400">Serão removidos: histórico de alertas enviados, recibos do mock, ocorrências recebidas e logs de workflow. Permanecem intactos: categorias, endpoints, API keys, automações, coordenadas gerais e preferências por categoria.</p><AlertDialog onOpenChange={open => { if (!open) setConfirmation(""); }}><AlertDialogTrigger asChild><Button variant="outline" className="shrink-0 border-rose-300/30 bg-rose-300/5 text-rose-200 hover:bg-rose-300/10">Resetar dados gerados</Button></AlertDialogTrigger><AlertDialogContent className="border-slate-700 bg-[#0c1b2b] text-slate-100"><AlertDialogHeader><AlertDialogTitle>Confirmar reset dos dados gerados</AlertDialogTitle><AlertDialogDescription className="text-slate-400">Esta ação é irreversível para os dados operacionais removidos. As configurações não serão modificadas.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><Label htmlFor="reset-confirmation" className="text-slate-300">Digite <code className="rounded bg-slate-900 px-1.5 py-0.5 text-rose-200">LIMPAR DADOS GERADOS</code> para confirmar</Label><Input id="reset-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="LIMPAR DADOS GERADOS" className="border-slate-700 bg-slate-950/40 font-mono text-slate-100" /></div><AlertDialogFooter><AlertDialogCancel className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white">Cancelar</AlertDialogCancel><AlertDialogAction disabled={!ready || isResetting} onClick={onReset} className="bg-rose-500 text-white hover:bg-rose-400">{isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Limpar dados</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card>;
}

function IntegrationView({ alertTypes, onConfig, onToggleAutomation, isSaving }: { alertTypes: SafeAlertType[]; onConfig: (item: SafeAlertType) => void; onToggleAutomation: (item: SafeAlertType) => void; isSaving: boolean }) {
  return <div className="space-y-6"><div><h2 className="text-xl font-semibold text-white">Integrações e automação</h2><p className="mt-1 text-sm text-slate-400">Defina destinos REST e prepare rotinas de disparo por categoria.</p></div><div className="grid gap-4">{alertTypes.map(item => <Card key={item.id} className="border-slate-800 bg-[#0c1b2b] shadow-none"><CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-100">{item.name}</p><Badge variant="outline" className={item.isTestMode ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-amber-400/25 bg-amber-400/10 text-amber-200"}>{item.isTestMode ? "Mock interno" : "REST externo"}</Badge>{item.hasAuthToken && <Badge variant="outline" className="border-slate-700 text-slate-400">Token protegido</Badge>}</div><p className="mt-2 truncate text-sm text-slate-500">{item.endpointUrl}</p></div><div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2"><Switch checked={item.autoEnabled} onCheckedChange={() => onToggleAutomation(item)} disabled={isSaving} /><span className="text-sm text-slate-300">Auto. {item.autoEnabled ? `a cada ${item.autoIntervalMinutes} min` : "desligada"}</span></div><Button onClick={() => onConfig(item)} variant="outline" className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"><Settings2 className="mr-2 h-4 w-4" />Configurar</Button></div></CardContent></Card>)}</div><Card className="border-amber-300/15 bg-amber-300/[0.04] shadow-none"><CardContent className="flex gap-3 p-5"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><p className="text-sm leading-6 text-slate-400">A automação é criada para o usuário autenticado e dispara pelo servidor em intervalos compatíveis. Depois de publicar o projeto, ela poderá ser ativada e pausada na própria tela de configurações.</p></CardContent></Card></div>;
}

function AxeReadinessPanel({ alertTypes }: { alertTypes: SafeAlertType[] }) {
  const withAxeProfile = alertTypes.filter(item => item.payloadTemplate.includes('"schemaVersion": "1.0"')).length;
  const awaitingEndpoint = alertTypes.filter(item => item.isTestMode || item.endpointUrl.startsWith("mock://")).length;
  return <Card className="border-cyan-300/15 bg-cyan-300/[0.04] shadow-none"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base text-cyan-100">Prontidão para AXE Dispatch</CardTitle><CardDescription className="mt-1 text-slate-400">O perfil é validado antes de salvar; nenhuma chamada externa será feita enquanto o modo teste estiver ativo.</CardDescription></div><Badge variant="outline" className={awaitingEndpoint ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"}>{awaitingEndpoint ? "Aguardando endpoint" : "Destino externo configurado"}</Badge></div></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-slate-700 bg-slate-950/30 p-3"><p className="text-xs uppercase tracking-wider text-slate-500">Perfil AXE</p><p className="mt-1 text-2xl font-semibold text-cyan-100">{withAxeProfile}/{alertTypes.length}</p><p className="mt-1 text-xs text-slate-500">Categorias com o modelo de ocorrência aplicado.</p></div><div className="rounded-lg border border-slate-700 bg-slate-950/30 p-3"><p className="text-xs uppercase tracking-wider text-slate-500">Liberação externa</p><p className="mt-1 text-2xl font-semibold text-amber-200">{awaitingEndpoint}</p><p className="mt-1 text-xs text-slate-500">Categorias ainda protegidas pelo mock interno.</p></div></CardContent></Card>;
}

export function EventConfigDialog({ draft, setDraft, onSave, isSaving, autoInterval, setAutoInterval, onAutomation, automationSaving }: { draft: ConfigDraft; setDraft: (value: ConfigDraft) => void; onSave: () => void; isSaving: boolean; autoInterval: string; setAutoInterval: (value: string) => void; onAutomation: () => void; automationSaving: boolean }) {
  const update = <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) => setDraft({ ...draft, [key]: value });
  const generateApiKey = () => {
    const value = generateIntegrationApiKey();
    setDraft({ ...draft, apiKey: value, clearApiKey: false });
    toast.success("API key gerada", { description: "Copie a chave agora e salve a configuração para protegê-la." });
  };
  const copyApiKey = async () => {
    if (!draft.apiKey) return toast.error("Gere ou informe uma API key antes de copiar.");
    await navigator.clipboard.writeText(draft.apiKey);
    toast.success("API key copiada para a área de transferência.");
  };
  return <>
    <DialogHeader><div className="flex items-start justify-between gap-4"><div><DialogTitle className="text-xl text-white">Configurar {draft.name}</DialogTitle><DialogDescription className="mt-2 text-slate-400">O token é mantido no servidor e as coordenadas selecionadas serão informadas na próxima comunicação do alarme.</DialogDescription></div><Badge variant="outline" className={severityStyle[draft.defaultSeverity]}>{draft.defaultSeverity}</Badge></div></DialogHeader>
    <div className="grid gap-5 py-3">
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="event-name" className="text-slate-300">Nome do evento</Label><Input id="event-name" value={draft.name} onChange={event => update("name", event.target.value)} className="border-slate-700 bg-slate-950/40 text-slate-100" /></div><div className="space-y-2"><Label className="text-slate-300">Nível de severidade</Label><Select value={draft.defaultSeverity} onValueChange={value => update("defaultSeverity", value as Severity)}><SelectTrigger className="border-slate-700 bg-slate-950/40 text-slate-100"><SelectValue /></SelectTrigger><SelectContent>{SEVERITY_OPTIONS.map(severity => <SelectItem key={severity} value={severity}>{severity}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="space-y-2"><Label htmlFor="description" className="text-slate-300">Descrição padrão</Label><Textarea id="description" value={draft.defaultDescription} onChange={event => update("defaultDescription", event.target.value)} className="min-h-20 border-slate-700 bg-slate-950/40 text-slate-100" /></div>
      <div className="flex items-center justify-between rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4"><div><p className="text-sm font-medium text-cyan-100">Usar localização geral</p><p className="mt-1 text-xs text-slate-400">Quando ativa, esta categoria herda a latitude e longitude definidas nas Configurações Gerais.</p></div><Switch aria-label="Usar localização geral" checked={draft.useGeneralLocation} onCheckedChange={value => update("useGeneralLocation", value)} /></div>
      {draft.useGeneralLocation ? <div className="rounded-xl border border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-400">A categoria usará a localização geral no próximo disparo. Desative esta opção para definir coordenadas exclusivas para esta categoria.</div> : <><CoordinatePicker value={{ latitude: draft.defaultLatitude, longitude: draft.defaultLongitude }} onChange={coordinates => { setDraft({ ...draft, defaultLatitude: coordinates.latitude, defaultLongitude: coordinates.longitude }); }} title="Localização própria da categoria" description="Esta posição será usada somente para esta categoria, a menos que uma coordenada temporária seja escolhida no simulador." markerTitle="Coordenada própria da categoria" /><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="latitude" className="text-slate-300">Latitude</Label><Input id="latitude" type="number" step="0.000001" value={draft.defaultLatitude} onChange={event => update("defaultLatitude", Number(event.target.value))} className="border-slate-700 bg-slate-950/40 text-slate-100" /></div><div className="space-y-2"><Label htmlFor="longitude" className="text-slate-300">Longitude</Label><Input id="longitude" type="number" step="0.000001" value={draft.defaultLongitude} onChange={event => update("defaultLongitude", Number(event.target.value))} className="border-slate-700 bg-slate-950/40 text-slate-100" /></div></div></>}
      <div className="grid gap-4 sm:grid-cols-[1fr,auto]"><div className="space-y-2"><Label htmlFor="endpoint" className="text-slate-300">Endpoint REST de destino</Label><Input id="endpoint" value={draft.endpointUrl} onChange={event => update("endpointUrl", event.target.value)} className="border-slate-700 bg-slate-950/40 text-slate-100" /></div><div className="flex items-end"><Button type="button" onClick={() => { update("endpointUrl", "mock://central-despacho"); update("isTestMode", true); }} variant="outline" className="border-emerald-400/30 bg-emerald-400/5 text-emerald-200 hover:bg-emerald-400/10">Usar mock</Button></div></div>
      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/30 p-4"><div><p className="text-sm font-medium text-slate-200">Modo teste</p><p className="mt-1 text-xs text-slate-500">Recebe a ocorrência no mock interno, sem conexão externa.</p></div><Switch aria-label="Modo teste" checked={draft.isTestMode} onCheckedChange={value => update("isTestMode", value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="headers" className="text-slate-300">Headers personalizados (JSON)</Label><Textarea id="headers" value={draft.headersJson} onChange={event => update("headersJson", event.target.value)} className="min-h-24 font-mono text-xs border-slate-700 bg-slate-950/40 text-slate-100" /></div><div className="space-y-2"><Label htmlFor="token" className="text-slate-300">Token Bearer</Label><Input id="token" type="password" value={draft.authToken} placeholder={draft.hasAuthToken ? "Token configurado — informe outro para substituir" : "Opcional"} onChange={event => update("authToken", event.target.value)} className="border-slate-700 bg-slate-950/40 text-slate-100" /><label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={draft.clearToken} onChange={event => update("clearToken", event.target.checked)} />Remover token existente</label></div></div>
      <div className="grid gap-4 rounded-xl border border-slate-700 bg-slate-950/20 p-4 sm:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)]"><div className="space-y-2"><Label htmlFor="api-key-header" className="text-slate-300">Nome do header da API key</Label><Input id="api-key-header" value={draft.apiKeyHeader} placeholder="x-api-key" onChange={event => update("apiKeyHeader", event.target.value)} className="border-slate-700 bg-slate-950/40 font-mono text-slate-100" /><p className="text-xs text-slate-500">Exemplos: <code>x-api-key</code> ou <code>x-api-token</code>.</p></div><div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label htmlFor="api-key" className="text-slate-300">API key</Label><div className="flex gap-1"><Button type="button" onClick={generateApiKey} variant="ghost" size="sm" className="h-7 px-2 text-xs text-cyan-200 hover:bg-cyan-300/10 hover:text-cyan-100"><Sparkles className="mr-1 h-3.5 w-3.5" />Gerar</Button><Button type="button" onClick={() => void copyApiKey()} variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"><Copy className="mr-1 h-3.5 w-3.5" />Copiar</Button></div></div><Input id="api-key" type="password" value={draft.apiKey} placeholder={draft.hasApiKey ? "API key configurada — informe outra para substituir" : "Opcional"} onChange={event => update("apiKey", event.target.value)} className="border-slate-700 bg-slate-950/40 font-mono text-slate-100" /><p className="text-xs text-slate-500">A geração usa 32 bytes aleatórios no navegador. Copie a chave antes de salvar.</p><label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={draft.clearApiKey} onChange={event => update("clearApiKey", event.target.checked)} />Remover API key existente</label></div></div>
      <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="payload" className="text-slate-300">Modelo de payload JSON</Label><div className="flex flex-wrap gap-1"><Button type="button" onClick={() => { setDraft(applyAlrtAxeProfile(draft)); toast.success("Perfil ALRT → AXE aplicado", { description: "URL, POST externo, API key, HMAC e payload de homologação foram preparados." }); }} variant="ghost" size="sm" className="text-xs text-emerald-200 hover:bg-emerald-300/10 hover:text-emerald-100">Aplicar ALRT → AXE</Button><Button type="button" onClick={() => update("payloadTemplate", AXE_DISPATCH_PAYLOAD_TEMPLATE)} variant="ghost" size="sm" className="text-xs text-amber-200 hover:bg-amber-300/10 hover:text-amber-100">Aplicar receptor da central</Button><Button type="button" onClick={() => update("payloadTemplate", DEFAULT_PAYLOAD_TEMPLATE)} variant="ghost" size="sm" className="text-xs text-cyan-300 hover:bg-cyan-300/10 hover:text-cyan-200">Restaurar modelo</Button></div></div><Textarea id="payload" value={draft.payloadTemplate} onChange={event => update("payloadTemplate", event.target.value)} className="min-h-52 font-mono text-xs leading-5 border-slate-700 bg-slate-950/40 text-slate-100" /><p className="text-xs text-slate-500">O perfil ALRT → AXE preenche a URL oficial, desativa o mock, limpa Bearer e headers antigos, usa X-ALRT-API-Key e assina o corpo bruto com HMAC-SHA256. Informe a API key de homologação antes de salvar.</p></div>
      <div className="flex flex-col gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-cyan-100">Disparo automático</p><p className="mt-1 text-xs text-slate-500">Intervalos aceitos: 5, 10, 15, 20, 30, 60, 120, 180, 360, 720 ou 1440 min.</p></div><div className="flex items-center gap-2"><Input type="number" min="5" value={autoInterval} onChange={event => setAutoInterval(event.target.value)} className="w-24 border-slate-700 bg-slate-950/40 text-slate-100" /><Button type="button" onClick={onAutomation} disabled={automationSaving} variant="outline" className="border-cyan-300/25 bg-transparent text-cyan-200 hover:bg-cyan-300/10">{draft.autoEnabled ? "Pausar" : "Ativar"}</Button></div></div>
    </div>
    <DialogFooter><Button onClick={onSave} disabled={isSaving} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar configuração</Button></DialogFooter>
  </>;
}

function ActivityIcon(props: React.SVGProps<SVGSVGElement>) { return <ArrowUpRight {...props} />; }

function WorkflowView({ monitor, onRefresh }: { monitor: { occurrences: any[]; logs: any[] }; onRefresh: () => void }) {
  const summary = {
    accepted: monitor.logs.filter(item => item.outcome === "accepted").length,
    duplicate: monitor.logs.filter(item => item.outcome === "duplicate").length,
    rejected: monitor.logs.filter(item => item.outcome === "invalid" || item.outcome === "unauthorized").length,
  };

  const copyConnectorValue = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold text-white">Workflow de recebimento</h2><p className="mt-1 text-sm text-slate-400">Ocorrências recebidas por API key e auditoria dos resultados de processamento.</p></div><Button onClick={onRefresh} variant="outline" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></div>
    <section className="grid gap-4 md:grid-cols-3"><Card className="border-emerald-300/15 bg-emerald-300/[0.04] shadow-none"><CardContent className="p-5"><p className="text-xs uppercase tracking-wider text-slate-500">Aceites</p><p className="mt-2 text-3xl font-semibold text-emerald-200">{summary.accepted}</p></CardContent></Card><Card className="border-sky-300/15 bg-sky-300/[0.04] shadow-none"><CardContent className="p-5"><p className="text-xs uppercase tracking-wider text-slate-500">Duplicidades</p><p className="mt-2 text-3xl font-semibold text-sky-200">{summary.duplicate}</p></CardContent></Card><Card className="border-rose-300/15 bg-rose-300/[0.04] shadow-none"><CardContent className="p-5"><p className="text-xs uppercase tracking-wider text-slate-500">Rejeições</p><p className="mt-2 text-3xl font-semibold text-rose-200">{summary.rejected}</p></CardContent></Card></section>
    <Card className="border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.08] to-[#0c1b2b] shadow-none"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-base text-cyan-100"><RadioTower className="h-4 w-4" />Conectar o workflow do Dispatch App</CardTitle><CardDescription className="mt-1 max-w-2xl text-slate-400">Configure uma etapa HTTP de saída no Dispatch App para que as ocorrências sejam recebidas, auditadas e protegidas contra duplicidade nesta central.</CardDescription></div><Badge variant="outline" className="w-fit border-emerald-300/30 bg-emerald-300/10 text-emerald-200">POST disponível</Badge></div></CardHeader><CardContent className="grid gap-5 xl:grid-cols-[1.25fr,0.75fr]"><div className="space-y-3"><div className="rounded-lg border border-slate-700 bg-slate-950/45 p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">URL do endpoint receptor</span><Button onClick={() => void copyConnectorValue(WORKFLOW_RECEIVER_URL, "URL")} variant="ghost" size="sm" className="h-7 px-2 text-cyan-200 hover:bg-cyan-300/10 hover:text-cyan-100"><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar</Button></div><code className="block break-all text-sm text-cyan-100">{WORKFLOW_RECEIVER_URL}</code></div><div className="overflow-hidden rounded-lg border border-slate-700"><Table><TableHeader><TableRow className="border-slate-700 hover:bg-transparent"><TableHead className="text-slate-500">Header</TableHead><TableHead className="text-slate-500">Valor a configurar</TableHead></TableRow></TableHeader><TableBody>{WORKFLOW_REQUIRED_HEADERS.map(header => <TableRow key={header.name} className="border-slate-800/80 hover:bg-slate-800/30"><TableCell className="font-mono text-xs text-cyan-200">{header.name}</TableCell><TableCell className="text-xs text-slate-300">{header.value}</TableCell></TableRow>)}</TableBody></Table></div><p className="text-xs leading-5 text-slate-500">O segredo da API key não é recuperável após o salvamento. Gere uma nova chave na configuração da categoria se necessário.</p></div><ol className="space-y-3 border-l border-cyan-300/25 pl-4">{WORKFLOW_CONFIGURATION_STEPS.map((step, index) => <li key={step} className="relative text-sm leading-6 text-slate-300"><span className="absolute -left-[1.6rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-cyan-300/40 bg-[#0c1b2b] text-[10px] font-semibold text-cyan-200">{index + 1}</span>{step}</li>)}</ol></CardContent></Card>
    <Card className="overflow-hidden border-slate-800 bg-[#0c1b2b] shadow-none"><CardHeader><CardTitle className="text-base text-slate-100">Resultados recentes</CardTitle><CardDescription className="text-slate-500">Cada tentativa é preservada para auditoria, inclusive rejeições.</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow className="border-slate-800 hover:bg-transparent"><TableHead className="text-slate-500">Data</TableHead><TableHead className="text-slate-500">Resultado</TableHead><TableHead className="text-slate-500">Referência</TableHead><TableHead className="text-slate-500">Detalhe</TableHead></TableRow></TableHeader><TableBody>{monitor.logs.length ? monitor.logs.map(item => <TableRow key={item.id} className="border-slate-800/80 hover:bg-slate-800/30"><TableCell className="text-sm text-slate-300">{timeLabel(item.createdAt)}</TableCell><TableCell><Badge variant="outline" className={workflowOutcomeStyle[item.outcome] ?? "border-slate-700 text-slate-300"}>{item.outcome}</Badge><p className="mt-1 text-xs text-slate-500">HTTP {item.httpStatus}</p></TableCell><TableCell className="font-mono text-xs text-cyan-200">{item.externalId || "—"}</TableCell><TableCell className="max-w-sm text-sm text-slate-400">{item.reason || "Ocorrência processada com sucesso."}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="h-36 text-center text-slate-500"><RadioTower className="mx-auto mb-3 h-6 w-6" />Nenhuma tentativa recebida pelo workflow.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    <Card className="overflow-hidden border-slate-800 bg-[#0c1b2b] shadow-none"><CardHeader><CardTitle className="text-base text-slate-100">Ocorrências aceitas</CardTitle><CardDescription className="text-slate-500">Registros únicos, protegidos contra duplicidade pelo identificador externo.</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow className="border-slate-800 hover:bg-transparent"><TableHead className="text-slate-500">Código</TableHead><TableHead className="text-slate-500">Ocorrência</TableHead><TableHead className="text-slate-500">Localização</TableHead><TableHead className="text-slate-500">Recebida</TableHead></TableRow></TableHeader><TableBody>{monitor.occurrences.length ? monitor.occurrences.map(item => <TableRow key={item.id} className="border-slate-800/80 hover:bg-slate-800/30"><TableCell><p className="font-mono text-xs text-cyan-200">{item.code}</p><p className="mt-1 text-xs text-slate-500">{item.priority}</p></TableCell><TableCell className="max-w-md"><p className="font-medium text-slate-200">{item.title}</p><p className="mt-1 line-clamp-1 text-sm text-slate-500">{item.narrative}</p></TableCell><TableCell><p className="text-sm text-slate-300">{item.address}</p><p className="mt-1 text-xs text-cyan-300">{Number(item.latitude).toFixed(6)}, {Number(item.longitude).toFixed(6)}</p></TableCell><TableCell className="text-sm text-slate-400">{timeLabel(item.receivedAt)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="h-36 text-center text-slate-500"><ShieldAlert className="mx-auto mb-3 h-6 w-6" />Nenhuma ocorrência aceita ainda.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
  </div>;
}
