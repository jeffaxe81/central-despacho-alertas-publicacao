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

## Não-recomendação deliberada

Não estou indicando uma opção como "a certa" — a escolha depende de fatores que só quem decide a operação da plataforma sabe: quantos consumidores reais estão previstos nos próximos meses, se já existe (ou vai existir) fila em outro módulo do Axesistemas, e se há exigência de auditoria/replay de longo prazo. Decidir isso por vocês seria inventar um requisito de negócio (Seção 46).

## Próximos passos (após decisão)

Qualquer opção escolhida é implementável de forma incremental sobre o que já existe (Framework de Conectores permanece igual nas 3); a diferença está só em "como o evento chega até ele".
