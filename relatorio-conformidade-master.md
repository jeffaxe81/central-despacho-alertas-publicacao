# Relatório de Conformidade — Motor de Eventos vs. Prompt Master

**Módulo:** Motor de Eventos (repositório `central-despacho-alertas-publicacao`, app "Central de Alertas Urbanas")
**Ciclo:** Adequação ao Prompt Master + previsão de compatibilidade com Despacho (AXE) e CRM
**Árvore analisada:** branch `main`, commit `d3c4d10`
**Status:** testes e tipagem executados nesta árvore antes de qualquer alteração ser considerada válida (Regra da Árvore Validada, Seção 27)

---

## 1. O que já está conforme

| Requisito do Master | Situação |
| --- | --- |
| Eventos versionados (Seção 8) | `schemaVersion`, `eventId`, `occurredAt`, `correlationId`, `idempotencyKey` já existem no envelope ALRT→AXE. |
| Cenários reproduzíveis (Seção 8) | Semente (`seed`) determinística já implementada e testada (`alertEngine.test.ts`). |
| Retry/idempotência/correlação (Seção 9) | `postWithRetry` com backoff 5/15/45s, respeita `Retry-After`, headers de correlação e idempotência. |
| Segredos fora do código (Seção 21) | `AXE_HMAC_SECRET` via variável de ambiente; API key não retorna ao navegador. |
| Autenticação própria (Seção 21) | Cadastro local com hash scrypt, sessão HTTP-only, sem OAuth de terceiro. |
| Qualidade bloqueante (Seção 24) | 58 testes automatizados + `tsc --noEmit` limpos nesta árvore. |
| Não invenção (Seção 46) | Contrato AXE é real e documentado; contrato CRM (novo, abaixo) foi marcado explicitamente como proposta, não como integração confirmada. |

## 2. Gaps identificados frente ao Master

| # | Gap | Seção do Master | Criticidade |
| --- | --- | --- | --- |
| 1 | Não existe integração com CRM | 7, 40 | Alta |
| 2 | Isolamento é por `userId`, não por `tenant_id` (multi-tenant, Seção 10) | 10 | Média |
| 3 | O motor despacha direto via REST ao destino configurado por categoria, em vez de publicar em um contrato/barramento consumido por N assinantes (princípio "o motor simula, os demais decidem") | 8 | Média-Alta |
| 4 | Sem Framework Universal de Conectores (Seção 9): cada integração (AXE, CRM) é um perfil de payload manual na UI, não um adapter reutilizável e testável por contrato | 9 | Média |
| 5 | Sem observabilidade formal (traces, correlation ID ponta a ponta em logs estruturados, dashboards) | 36 | Média |
| 6 | Segredos de API key e token ficam no banco de dados por categoria — correto não estarem no código, mas falta avaliação de criptografia em repouso / cofre de segredos dedicado | 21 | Média |
| 7 | Sem versionamento semântico do próprio módulo (não há tags Git) | 29 | Baixa |

## 3. O que foi feito neste ciclo (implementado e testado)

- Criado `ALRT_CRM_INGRESS_PAYLOAD_TEMPLATE` em `shared/alertSimulation.ts`: envelope versionado (`schemaVersion`, `eventId`, `eventType: "occurrence.registered"`, `correlationId`, `idempotencyKey`, `data.occurrence`, `data.contact`), seguindo o mesmo padrão já homologado com o AXE.
- Criado `client/src/lib/alrtCrmProfile.ts` (perfil "ALRT → CRM"), espelhando `alrtAxeProfile.ts`, mas **mantendo modo teste ativo e endpoint vazio propositalmente**, pois o CRM ainda não forneceu contrato oficial (schema, autenticação, endpoint real) — evitando violar a Seção 46 (não inventar requisito/URL).
- Botão "Aplicar ALRT → CRM (proposta)" adicionado na tela de configuração de integração, ao lado do já existente "Aplicar ALRT → AXE".
- Testes automatizados criados (`alrtCrmProfile.test.ts`) e suíte completa reexecutada: **58 testes passando, 1 skip pré-existente** (health check AXE, que já era condicional a ambiente).
- `tsc --noEmit` sem erros.

## 4. Backlog registrado (sem prazo, conforme Seção 33)

| Item | Prioridade | Depende de |
| --- | --- | --- |
| Confirmar contrato oficial do CRM (schema, auth, endpoint) e então ativar o perfil ALRT → CRM em produção | Alta | Time do CRM fornecer contrato equivalente ao `CONTRATO_ENTRADA_ALRT_AXE.md` |
| Adicionar `tenant_id` ao schema (`alert_types`, `dispatched_alerts`, `general_settings`) preservando `userId` como está, para permitir multi-tenant sem quebrar o modelo atual | Média | Decisão de produto sobre shared-DB + tenant_id (Seção 10) |
| Extrair um Framework de Conectores mínimo (interface comum: configurar → transformar → enviar → registrar) para que AXE e CRM (e futuros destinos) parem de ser perfis hardcoded na UI | Média-Alta | Nenhuma; pode iniciar já no próximo ciclo |
| Avaliar modelo de publicação por contrato/barramento (em vez de POST direto por categoria) para múltiplos consumidores simultâneos | Média | Definição de qual barramento (fila, webhook registry, etc.) |
| Observabilidade: logs estruturados com correlation ID ponta a ponta, métricas de entrega por destino | Média | Nenhuma |
| Cofre de segredos dedicado para API keys/tokens armazenados por categoria | Baixa-Média | Infraestrutura de secrets management |
| Versionamento semântico do módulo com tags Git | Baixa | Nenhuma |

## 5. Não realizado neste ciclo (declarado explicitamente, Seção 46)

- Nenhum commit ou push foi feito nesta sessão — as alterações estão apenas na árvore de trabalho local. Não houve credencial de escrita configurada para este repositório.
- Nenhuma migração de banco foi criada (o gap de `tenant_id` está registrado em backlog, não implementado).
- Nenhum endpoint real de CRM foi contatado ou validado — o perfil é uma proposta de schema aguardando confirmação.
