import type { Response } from "express";

/**
 * Broadcaster SSE (Server-Sent Events) para assinaturas do barramento de
 * eventos (ADR-0001, Opção 1 — entrega por assinatura).
 *
 * LIMITAÇÃO DECLARADA: este broadcaster é em memória, por processo. Ele
 * funciona corretamente em uma única instância do servidor. Se a aplicação
 * rodar em múltiplas instâncias (múltiplos processos/containers atrás de um
 * load balancer), um assinante conectado à instância A não recebe eventos
 * publicados via a instância B. Resolver isso exige um backplane de pub/sub
 * compartilhado (Redis pub/sub, por exemplo) — que é, na prática, um passo
 * em direção à Opção 2 (fila/broker gerenciado) do ADR-0001. Registrado em
 * backlog; não implementado aqui por não haver infraestrutura provisionada
 * para isso nesta sessão (Seção 46 — não inventar/assumir infraestrutura).
 */

type SubscriberKey = string;

const clientsByKey = new Map<SubscriberKey, Set<Response>>();

export function registerSseClient(subscriberApiKey: SubscriberKey, res: Response): void {
  const set = clientsByKey.get(subscriberApiKey) ?? new Set<Response>();
  set.add(res);
  clientsByKey.set(subscriberApiKey, set);
}

export function unregisterSseClient(subscriberApiKey: SubscriberKey, res: Response): void {
  const set = clientsByKey.get(subscriberApiKey);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clientsByKey.delete(subscriberApiKey);
}

export function connectedClientCount(subscriberApiKey: SubscriberKey): number {
  return clientsByKey.get(subscriberApiKey)?.size ?? 0;
}

/** Envia o evento a todos os clientes SSE conectados para esta chave de assinante. Retorna quantos receberam. */
export function broadcastToSse(subscriberApiKey: SubscriberKey, event: Record<string, unknown>): number {
  const set = clientsByKey.get(subscriberApiKey);
  if (!set || set.size === 0) return 0;
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of Array.from(set)) {
    res.write(line);
  }
  return set.size;
}

/** Uso em testes: limpa todo o estado do broadcaster. */
export function resetSseBroadcasterForTests(): void {
  clientsByKey.clear();
}
