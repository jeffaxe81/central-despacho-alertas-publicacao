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

## 4. Ciclo 2 — Framework Universal de Conectores (concluído e testado)

Extraído o Framework de Conectores (Seção 9) a partir da duplicação AXE/CRM do Ciclo 1:

- `shared/connectors/types.ts`: `ConnectorDescriptor` (id, versão, status homologado/proposta, estratégia de auth, template, campos exigidos do envelope) + `checkConnectorContract(...)`, validador de contrato reutilizável.
- `shared/connectors/registry.ts`: `CONNECTOR_AXE` e `CONNECTOR_CRM` como dados declarativos; `CONNECTORS` é o ponto único de registro — um novo destino não exige nova função nem novo teste manual.
- `client/src/lib/connectorProfile.ts`: `applyConnectorProfile(connector, draft)` — implementação única que substitui a lógica antes duplicada em `alrtAxeProfile.ts`/`alrtCrmProfile.ts` (mantidos como wrappers finos por compatibilidade, Seção 35).
- `shared/connectors/registry.contract.test.ts`: teste de contrato genérico (`it.each(CONNECTORS)`) que valida automaticamente todo conector registrado — inclui regra de segurança "conector em status 'proposta' nunca tem endpoint real nem sai do modo teste por padrão".
- Corrigido `vitest.config.ts`: `shared/**/*.test.ts` não estava no `include`, então os testes de contrato não rodavam. Achado durante a validação deste ciclo — sem essa correção, o teste de contrato existia mas nunca era executado (violaria a Seção 24, qualidade bloqueante).
- Suíte completa reexecutada após cada mudança: **62 testes passando, 1 skip pré-existente**; `tsc --noEmit` limpo.

## 7. Ciclo 3 — Dispatcher passa a consultar o registro de conectores (concluído e testado)

Fechada a lacuna registrada no backlog do Ciclo 2 ("servidor ainda não consulta o registro"):

- `server/alertEngine.ts`: nova função `matchConnectorByPayload(payload)` identifica, pelo campo `eventType` do payload já interpolado, a qual `ConnectorDescriptor` registrado ele corresponde.
- **Trava de segurança adicionada:** se o conector identificado estiver em status `"proposta"` (hoje, o CRM) e `isTestMode` estiver desligado, o despacho é bloqueado antes de qualquer chamada de rede, com mensagem explícita apontando para este relatório. Isso impede que um usuário desligue o modo teste manualmente e envie, sem querer, para um contrato ainda não confirmado — a garantia que antes só existia como *default* na UI (Ciclo 2) agora é reforçada no servidor.
- A lógica antes específica do AXE (`isAlrtAxeEnvelope`) foi generalizada para usar o mesmo registro, sem alterar o comportamento já homologado (headers, HMAC, exigência de API key).
- Testes novos em `server/alertEngine.test.ts`: bloqueio do conector "proposta" fora do modo teste, e confirmação de que o mesmo conector funciona normalmente em modo teste (mock interno).
- Suíte completa: **64 testes passando, 1 skip pré-existente**; `tsc --noEmit` limpo.

Com isso, o Framework de Conectores cobre agora as três camadas: contrato (`shared/connectors`), UI (`connectorProfile.ts`) e dispatcher (`alertEngine.ts`).

## 9. Ciclo 4 — Multi-tenant: coluna `tenant_id` (Fase 1 de 2, concluída e testada)

Implementado o modelo preferencial indicado pela Seção 10 do Master (**Shared Database + tenant_id**), em duas fases deliberadamente separadas para não misturar mudança de schema com mudança de regra de negócio no mesmo ciclo:

**Fase 1 (este ciclo):**
- `shared/tenant.ts`: constante `DEFAULT_TENANT_ID = "default"`.
- Coluna `tenant_id` (`varchar(64) NOT NULL DEFAULT 'default'`) adicionada a **todas as 7 tabelas** (`users`, `alert_types`, `general_settings`, `dispatched_alerts`, `mock_receipts`, `received_workflow_occurrences`, `workflow_process_logs`).
- Migração gerada via `drizzle-kit generate`: `drizzle/0010_add_tenant_id.sql` — puramente aditiva (`ADD COLUMN ... DEFAULT 'default' NOT NULL`), seguro para aplicar sobre dados existentes sem backfill manual.
- **Nenhuma query foi alterada** para filtrar por tenant ainda — a coluna existe e é preenchida automaticamente pelo banco, mas nenhum código de aplicação lê ou escreve nela intencionalmente por enquanto.
- Suíte completa reexecutada: **64 testes passando** (nenhum teste novo era necessário nesta fase, pois não há comportamento de aplicação para verificar sem um banco real — o valor padrão é responsabilidade do MySQL); `tsc --noEmit` limpo.
- **Migração não aplicada** a nenhum banco real: não há `DATABASE_URL` de produção/homologação configurada nesta sessão, nem autorização para rodar `drizzle-kit migrate` contra um ambiente real (Seção 46 — não declarar migração aplicada sem evidência).

**Fase 2 (concluída neste ciclo — propagação nas escritas):**
- `getUserTenantId(userId)` em `server/db.ts`: resolve o tenant real do usuário (consulta `users.tenantId`), com fallback ao `DEFAULT_TENANT_ID` quando o banco não está disponível.
- Todas as funções de **escrita** que criam registros por usuário passaram a carimbar `tenantId` com o valor real (em vez de depender só do default do banco): `ensureDefaultAlertTypes`, `getGeneralSettings`/`updateGeneralSettings`, `createWorkflowOccurrence`, `createWorkflowProcessLog`, `createDispatchedAlert`, `recordMockReceipt`.
- `upsertUser`/`createPasswordUser` foram deixados como estão: continuam usando o default do banco (`"default"`), pois **não existe hoje um fluxo de onboarding que atribua um usuário a um tenant específico** — inventar essa atribuição seria violar a Seção 46 (não inventar requisito).
- Teste novo: `server/db.tenant.test.ts` cobre o fallback de `getUserTenantId` sem banco disponível. A resolução real via `users.tenantId` em um banco vivo **não foi testada nesta sessão** (não há banco real disponível) — declarado explicitamente, não fica implícito como "testado".
- **Leituras não foram alteradas.** Motivo: hoje `userId` já é exclusivo por tenant (um usuário pertence a exatamente um tenant), então filtrar por `userId` já impede vazamento entre tenants nas consultas existentes. Adicionar filtro por `tenantId` às leituras só passa a ter efeito prático quando existir um recurso que precise ser visto por múltiplos usuários de um mesmo tenant (ex.: painel de equipe/organização) — que não existe ainda. Implementar esse filtro agora seria código morto sem cenário de teste real. Registrado como Fase 3, condicionada a essa feature existir.
- Suíte completa: **65 testes passando, 1 skip pré-existente**; `tsc --noEmit` limpo.

**Fase 3 (backlog, não iniciada):** quando existir um recurso multiusuário por tenant (ex.: equipe/organização vendo dados uns dos outros), aí sim adicionar filtro `WHERE tenant_id = ?` nas leituras relevantes e índices compostos (`tenant_id` + coluna já indexada).

## 12. Ciclo 6 — CI mínimo (concluído)

Fechado o item de risco levantado no `RELEASE-1.0.0.md` ("sem CI, cada push depende de validação manual local"):

- `.github/workflows/ci.yml`: pipeline mínimo (Seção 24, qualidade bloqueante) rodando em todo push/PR para `main`: instala dependências, `pnpm run check` (tipagem), `pnpm test` (suíte completa), `pnpm run build` (build de produção).
- Validado localmente antes de criar o workflow: `pnpm run build` funciona sem `DATABASE_URL` (bundling estático; nenhuma conexão real ao banco ocorre no build).
- **Não foi possível observar uma execução real do workflow no GitHub Actions nesta sessão** (isso só acontece depois que o arquivo for publicado e um push/PR disparar o job) — declarado explicitamente, não presumido como "CI verde".

## 14. Ciclo 7 — Observabilidade: logs estruturados ponta a ponta (concluído)

Fecha o item de backlog da Seção 36 (operações críticas rastreáveis ponta a ponta):

- `server/observability/logger.ts`: `logEvent(level, event, fields)` — uma linha JSON por evento (`timestamp`, `level`, `event` + campos livres), pronta para qualquer coletor de logs indexar por campo (correlationId, eventId, tenantId, connectorId etc.). Escopo deliberadamente mínimo: métricas agregadas e dashboards dependem de qual coletor/APM for adotado — decisão de infraestrutura que não cabe a este módulo antecipar (Seção 46).
- Instrumentado o caminho crítico do Motor de Eventos em `alertEngine.ts` (`dispatchConfiguredAlert`): eventos `dispatch.attempt`, `dispatch.success`, `dispatch.failure`, `dispatch.exception` e `dispatch.blocked_proposta` — todos carregando `correlationId`/`eventId` da ocorrência, `connectorId` do registro e `tenantId`/`userId` do alerta, permitindo rastrear um envio específico ponta a ponta pelos logs.
- Testes novos: `server/observability/logger.test.ts` (formato JSON, roteamento por nível) e uma asserção adicional no teste de bloqueio de conector "proposta" confirmando que o log estruturado correspondente é emitido.
- Suíte completa: **67 testes passando, 1 skip pré-existente**; `tsc --noEmit` limpo.

## 16. Ciclo 8 — Barramento de eventos: Opção 2 (alvo) com contingência 1+3, webhook e SSE (concluído)

Decisão do usuário: Opção 2 (fila gerenciada) como alvo, Opções 1 e 3 como contingência, aceitando webhook e SSE por assinatura com API key. Ver `docs/adr-0001-barramento-eventos.md` para a análise completa.

- Tabelas novas: `event_outbox` (durabilidade) e `event_subscriptions` (assinaturas), migração `drizzle/0011_add_event_bus.sql` gerada (não aplicada a banco real — mesma ressalva do Ciclo 4).
- `server/eventBus/publish.ts`, `sseBroadcaster.ts`, `sseRoute.ts`: publicação, fan-out (webhook + SSE) e stream autenticado por API key.
- `dispatchConfiguredAlert` publica no barramento independentemente do destino primário do `alertType` (Seção 8).
- CRUD de assinaturas via tRPC (`eventSubscriptions.list/create/setActive`), autenticado, com `subscriberApiKey` gerada uma única vez.
- Corrigidos durante a validação: constraint UNIQUE duplicada no schema; bug de lógica que marcaria uma assinatura SSE sem clientes conectados como "delivered" (corrigido para "failed").
- Testes novos: `publish.test.ts` (4), `sseBroadcaster.test.ts` (2). Suíte completa: **73 testes passando, 1 skip pré-existente**; `tsc --noEmit` limpo; `pnpm run build` validado.
- **Limitações declaradas:** broadcaster SSE em memória (não escala para múltiplas instâncias sem backplane compartilhado); Opção 2 real (broker gerenciado) não conectada — sem infraestrutura/acesso de rede a um serviço de fila neste ambiente; migração não aplicada a banco real.

## 18. Ciclo 9 — UI de gerenciamento de assinaturas (concluído)

- Nova aba "Assinaturas" (`/assinaturas`) em `Home.tsx`: formulário de criação (nome, categoria, modo webhook/SSE, endpoint) e lista com toggle ativo/pausado.
- `SubscriptionsView` mantido **prop-driven** (sem chamar tRPC diretamente), seguindo o mesmo padrão dos demais componentes de tela do projeto — os hooks (`list`, `create`, `setActive`) ficam no componente `Home`, o que manteve o componente testável em isolamento como os demais.
- A `subscriberApiKey` é exibida uma única vez, logo após a criação, com botão de copiar — mesmo padrão de segredo já usado no restante da plataforma.
- Testes novos: `Home.subscriptions.test.tsx` (3 testes: criação webhook, validação de endpoint obrigatório, exibição de API key + toggle).
- Suíte completa: **76 testes passando, 1 skip pré-existente**; `tsc --noEmit` limpo; `pnpm run build` validado.

## 20. Ciclo 10 — Remoção de código morto e Docker local (concluído)

- Removido `client/src/components/ManusDialog.tsx`: componente de diálogo de login "com Manus", morto (não importado em lugar nenhum), sobra da migração para autenticação local por e-mail/senha. Confirmado com `tsc --noEmit`, suíte completa e build antes e depois da remoção — nenhuma diferença.
- **Não removido** (avaliado e explicado ao usuário): `server/_core/*` (SDK de sessão, agendador de automação, proxy de mapas), `vite-plugin-manus-runtime`, e o endpoint `manus.space` do AXE Dispatch — são infraestrutura ativa da plataforma de hospedagem atual e do parceiro AXE, não "branding" removível sem substituir autenticação, agendamento e geocoding por conta própria. Decisão de quando/se migrar isso fica com o usuário.
- `Dockerfile` (multi-stage, build + runtime) e `docker-compose.yml` (app + MySQL 8.4) criados para rodar o projeto localmente com banco real.
- `docs/docker.md`: guia de uso, incluindo como aplicar as migrações pendentes contra o MySQL do compose.
- **Limitação declarada:** Docker não está disponível neste ambiente de trabalho — a sintaxe do `docker-compose.yml` foi validada, mas o build/execução reais **não foram testados** nesta sessão. Fica pendente de validação pelo usuário no próprio ambiente.

## 21. Backlog atualizado (sem prazo, conforme Seção 33)

| Item | Prioridade | Depende de |
| --- | --- | --- |
| Confirmar contrato oficial do CRM (schema, auth, endpoint) e então ativar o conector CRM em produção | Alta | Time do CRM fornecer contrato equivalente ao `CONTRATO_ENTRADA_ALRT_AXE.md` |
| Adicionar `tenant_id` ao schema (`alert_types`, `dispatched_alerts`, `general_settings`) preservando `userId` como está, para permitir multi-tenant sem quebrar o modelo atual | ~~Média~~ **Fase 1 e 2 concluídas (Ciclos 4 e 5)** | **Fase 3:** filtro de leitura por tenant — só quando existir feature multiusuário por tenant |
| Estender o Framework de Conectores para o lado servidor: hoje o registro (`shared/connectors`) descreve o contrato, mas `alertEngine.ts`/`dispatchConfiguredAlert` ainda não consultam o `ConnectorDescriptor` para validar auth/versão antes de enviar | ~~Média-Alta~~ **Concluído no Ciclo 3** | — |
| Avaliar modelo de publicação por contrato/barramento (em vez de POST direto por categoria) para múltiplos consumidores simultâneos | ~~Média~~ **Opções 1 e 3 implementadas no Ciclo 8 (webhook + outbox)** | **Opção 2 real** (broker gerenciado): sem infraestrutura provisionada nesta sessão |
| Backplane compartilhado para SSE em múltiplas instâncias (Redis pub/sub ou similar) | Média | Decisão de infraestrutura + Opção 2 |
| UI para gerenciar assinaturas do barramento (hoje só via tRPC, sem tela) | ~~Baixa-Média~~ **Concluído no Ciclo 9** | — |
| Observabilidade: logs estruturados com correlation ID ponta a ponta, métricas de entrega por destino | ~~Média~~ **Logs estruturados concluídos no Ciclo 7** | Métricas agregadas/dashboards ficam para quando houver decisão de qual coletor/APM adotar |
| Cofre de segredos dedicado para API keys/tokens armazenados por categoria | Baixa-Média | Infraestrutura de secrets management |
| Versionamento semântico do módulo com tags Git | Baixa | Nenhuma |

## 6. Não realizado neste ciclo (declarado explicitamente, Seção 46)

- Nenhum push foi feito — apenas checkpoints locais (`git commit`). Não há credencial de escrita configurada para este repositório remoto.
- Nenhuma migração de banco foi criada (o gap de `tenant_id` está registrado em backlog, não implementado).
- Nenhum endpoint real de CRM foi contatado ou validado — o conector é uma proposta de schema aguardando confirmação.
- O lado servidor (`alertEngine.ts`) ainda não consulta o registro de conectores; a extração cobriu o contrato e a camada de UI/testes, não o dispatcher em si (registrado em backlog). **[Concluído no Ciclo 3 — ver Seção 7]**
- A migração `0010_add_tenant_id.sql` não foi aplicada a nenhum banco real (sem `DATABASE_URL` de ambiente configurada nesta sessão). A coluna existe no schema e na migração gerada, mas seu efeito em um banco vivo não foi observado nem testado nesta sessão.
- O isolamento lógico por tenant (filtrar queries por `tenantId`) não foi implementado — apenas a coluna existe (Ciclo 4, Fase 1). Ver Fase 2 no backlog. **[Fase 2 — propagação nas escritas — concluída no Ciclo 5; filtro de leitura permanece Fase 3, condicionado a feature multiusuário]**
- A resolução de `getUserTenantId` a partir da tabela `users` em um banco real não foi testada nesta sessão — só o fallback sem banco foi verificado.
