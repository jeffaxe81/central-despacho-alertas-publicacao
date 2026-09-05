# ADR-0001 — Modelo de publicação de eventos (barramento) do Motor de Eventos

**Status:** proposta para decisão — nenhuma opção foi implementada
**Contexto:** Seção 8 do Prompt Master ("o Motor simula o mundo, os demais decidem o que fazer com os eventos") e item de backlog "avaliar modelo de publicação por contrato/barramento em vez de POST direto por categoria"
**Por que isso não foi implementado direto:** decisão de infraestrutura tem custo operacional e financeiro real; implementar sem essa escolha ser sua violaria a Seção 46 (não inventar requisito/decisão que não é minha para tomar)

---

## O problema

Hoje, cada `alertType` despacha para **um único destino fixo** (a URL configurada), via POST direto (`postWithRetry`). Isso funciona bem para 1 consumidor por categoria, mas não escala para o cenário que o Master descreve: o mesmo evento sendo consumido por **múltiplos módulos simultaneamente** (Despacho/AXE, CRM, e futuros) sem que o Motor precise saber quem são eles.

O Framework de Conectores (já implementado) resolve **o quê** enviar para cada destino (contrato, versão, auth). Falta resolver **como** um evento chega a N consumidores de forma desacoplada.

---

## Opção 1 — Webhook Registry (evolução do modelo atual)

Em vez de 1 endpoint por `alertType`, cada evento é enviado a **todos os conectores inscritos** para aquela categoria (uma tabela `event_subscriptions`: categoria/tipo de evento → lista de conectores ativos). Continua usando `postWithRetry` e o Framework de Conectores como estão.

| Critério | Avaliação |
| --- | --- |
| Infraestrutura nova | Nenhuma — só uma tabela nova e um loop de envio |
| Esforço de implementação | Baixo |
| Durabilidade / replay | Fraca — se o consumidor cair por horas, os eventos daquele período se perdem (mesma limitação de hoje) |
| Múltiplos consumidores | Sim, nativamente |
| Acoplamento do Motor | Continua sabendo "para quem enviar" (mesmo que agora seja uma lista, não 1 destino) — não é o desacoplamento pleno da Seção 8 |
| Operação | Nenhuma peça nova para monitorar |

**Quando faz sentido:** se o número de consumidores é pequeno e conhecido (2-3), e a indisponibilidade prolongada de um consumidor é rara/aceitável.

---

## Opção 2 — Fila gerenciada (RabbitMQ / AWS SQS / Redis Streams)

O Motor publica o evento em uma fila; cada consumidor (Despacho, CRM, futuros) lê da fila em seu próprio ritmo. O Motor não sabe quem consome.

| Critério | Avaliação |
| --- | --- |
| Infraestrutura nova | Sim — serviço de fila a provisionar/operar (ou contratar gerenciado) |
| Esforço de implementação | Médio-Alto — novo cliente, novo modelo de erro/retry do lado da fila, dead-letter queue |
| Durabilidade / replay | Forte — mensagens persistem até serem confirmadas; replay possível conforme retenção configurada |
| Múltiplos consumidores | Sim, e cada um consome no seu ritmo (backpressure não afeta os outros) |
| Acoplamento do Motor | Nenhum — publica e esquece, exatamente o princípio da Seção 8 |
| Operação | Nova peça de infra: monitorar fila, filas mortas, custo do serviço gerenciado |

**Quando faz sentido:** se o número de consumidores vai crescer, se a plataforma já vai precisar de fila para outras coisas (Motor de Eventos não seria o único caso de uso), ou se durabilidade/replay são requisito real (ex.: auditoria regulatória de todo evento emitido).

---

## Opção 3 — Outbox no MySQL já existente (sem nova infraestrutura)

Cada evento gerado grava uma linha em uma tabela `event_outbox` (dentro da mesma transação da geração, se aplicável). Um worker (cron ou processo separado) lê eventos pendentes e os entrega a cada conector inscrito via `postWithRetry`, marcando status por consumidor. É essencialmente a Opção 1, mas com uma tabela de log de eventos bruta e desacoplada, em vez de reenviar a partir do `alertType` diretamente — o Motor grava "aconteceu X" e o worker decide para quem replicar.

| Critério | Avaliação |
| --- | --- |
| Infraestrutura nova | Nenhuma — reaproveita o MySQL já em uso |
| Esforço de implementação | Médio — nova tabela, worker de entrega, status por consumidor |
| Durabilidade / replay | Boa — evento persiste na tabela até ser processado; replay é reprocessar linhas |
| Múltiplos consumidores | Sim |
| Acoplamento do Motor | Baixo — o Motor só grava "o que aconteceu", não decide quem recebe (isso migra para o worker/registro de assinaturas) |
| Operação | Precisa de um processo rodando o worker (cron já existe no projeto para `scheduledAlerts.ts` — reaproveitável) |

**Quando faz sentido:** se você quer o desacoplamento real da Seção 8 **sem** assumir o custo/operação de uma fila gerenciada agora, e já confia no MySQL como fonte de verdade.

---

## Comparação resumida

| | Opção 1 (Webhook Registry) | Opção 2 (Fila gerenciada) | Opção 3 (Outbox MySQL) |
| --- | --- | --- | --- |
| Infra nova | Não | Sim | Não |
| Esforço | Baixo | Alto | Médio |
| Durabilidade | Fraca | Forte | Boa |
| Desacoplamento (Seção 8) | Parcial | Total | Quase total |
| Risco operacional | Baixo | Médio-Alto (nova peça) | Baixo-Médio |

## Decisão registrada

**Aceita:** Opção 2 (fila/broker gerenciado) como alvo, com Opção 1 (webhook registry) e Opção 3 (outbox MySQL) como contingência — implementadas primeiro, por não haver infraestrutura de fila provisionada nesta sessão (sem acesso de rede a Redis/RabbitMQ/SQS neste ambiente). A entrega por assinatura aceita **webhook e SSE**, autenticados por API key.

**O que foi implementado (Ciclo 8):**
- `event_outbox` (Opção 3): toda publicação é gravada aqui, com status/contadores de entrega — serve de log durável e será a fonte que um consumidor de fila real (Opção 2) poderá ler no futuro, sem re-arquitetar o Motor.
- `event_subscriptions`: assinantes registram-se (via `eventSubscriptions.create`, tRPC autenticado) com `deliveryMode` webhook ou sse, filtro por categoria (ou todas), e recebem uma `subscriberApiKey` única (mostrada uma única vez).
- `server/eventBus/publish.ts`: publica no outbox e faz fan-out — webhook via `postWithRetry` já homologado; SSE via broadcaster em memória.
- `server/eventBus/sseRoute.ts`: `GET /api/events/stream`, autenticado por `Authorization: Bearer <subscriberApiKey>` (ou `?api_key=` como fallback para clientes de navegador).
- **Limitação declarada:** o broadcaster SSE é em memória, por processo — não funciona em múltiplas instâncias sem um backplane de pub/sub compartilhado (que seria, na prática, um passo em direção à própria Opção 2). Ver `server/eventBus/sseBroadcaster.ts`.
- A Opção 2 real (broker gerenciado) **não foi conectada** — não há infraestrutura provisionada nem acesso de rede a um serviço de fila neste ambiente. O outbox foi desenhado justamente para permitir essa evolução futura sem retrabalho.
