# Hardening de produção — implementação inicial

## Escopo

Esta branch (`hardening/production-readiness`) implementa a primeira tranche das correções prioritárias identificadas na avaliação do projeto. O objetivo foi reduzir os riscos P0/P1 sem alterar o contrato funcional existente do simulador.

## Alterações realizadas

### Configuração e sessões

`server/_core/env.ts` passou a validar `JWT_SECRET` e `DATABASE_URL` quando `NODE_ENV=production`. O processo falha no startup se o segredo JWT tiver menos de 32 caracteres ou se a URL do banco não estiver configurada.

A validação é condicional ao ambiente de produção para preservar execução local e testes sem exigir segredo externo. O pipeline de produção deve sempre fornecer os valores por secret manager.

### Proteção HTTP

Foi criado `server/_core/security.ts` com:

- headers básicos de segurança;
- desativação de `X-Powered-By` no bootstrap;
- rate limiting local por IP ou credencial;
- exigência de HTTPS para APIs em produção;
- limite de requisições para workflow/mock;
- limite de conexões de abertura da rota SSE.

O rate limiter é um guardrail local. Em múltiplas réplicas, deve ser substituído ou complementado por um mecanismo compartilhado no gateway ou Redis.

O limite global de body parser foi reduzido de 50 MB para 256 KB. Se houver upload futuro, ele deve receber uma rota e limite próprios.

### Validação anti-SSRF

`server/alertEngine.ts` agora:

- resolve o hostname antes do envio;
- rejeita IPv4 privado, loopback, link-local, metadata e ranges reservados;
- rejeita blocos IPv6 privados e loopback;
- rejeita credenciais embutidas na URL;
- exige HTTPS em produção;
- mantém `allowPrivateEndpointForTest` somente para testes explícitos;
- mantém o bypass DNS limitado ao ambiente de teste.

A proteção deve ser complementada por validação de redirects e, em produção, por uma allowlist de destinos aprovados.

### Cabeçalhos personalizados

`parseHeaders()` passou a validar também os nomes dos cabeçalhos, evitando nomes inválidos ou potencialmente ambíguos.

### Outbox

O schema recebeu campos para:

- número de tentativas;
- próximo horário de tentativa;
- lease (`lockedUntil` e `lockedBy`);
- último erro;
- data de entrega;
- data de dead letter;
- índice para replay.

Também foi criada a tabela `event_outbox_deliveries`, que permite controlar a entrega individual por assinatura, em vez de apenas manter contadores agregados no evento.

A migração está em `drizzle/0012_outbox_replay.sql`.

Foi criado `server/eventBus/outboxWorker.ts` com:

- processamento por lote;
- backoff exponencial com jitter;
- classificação de erros retentáveis;
- máximo de tentativas;
- dead letter;
- lease lógico via store;
- parada por `AbortSignal`;
- implementação testável por injeção de dependências.

A camada de transporte e o store MySQL ainda precisam ser conectados ao processo de produção. O worker não deve ser iniciado dentro de cada réplica HTTP sem coordenação, pois isso criaria consumidores duplicados.

## Validação executada

```text
pnpm check
Aprovado

pnpm test
29 arquivos aprovados, 1 ignorado
117 testes aprovados, 1 ignorado
```

Os testes adicionados ao worker cobrem sucesso, retry de 5xx, dead letter e parada por abort.

## Pendências obrigatórias antes de produção

1. Criar o adapter MySQL de `OutboxWorkerStore` usando transação e `SELECT ... FOR UPDATE SKIP LOCKED`.
2. Criar processo separado ou modo de execução exclusivo para o worker.
3. Mudar `publishEvent()` para enfileirar entregas, em vez de fazer fan-out síncrono dentro do despacho primário.
4. Criar job de reconciliação para atualizar estados agregados da outbox.
5. Persistir API keys como hash ou valor cifrado e implementar rotação/revogação.
6. Remover payloads brutos de logs operacionais ou aplicar redaction e retenção.
7. Tornar `tenantId` obrigatório no contexto e em todas as queries.
8. Adicionar testes negativos de isolamento entre tenants.
9. Validar redirects de webhook e aplicar allowlist de destinos.
10. Configurar rate limit compartilhado no gateway para múltiplas réplicas.

## Token GitHub fornecido durante a execução

Nenhum token foi usado ou gravado no projeto. O acesso GitHub já estava autenticado por integração existente. Como o token foi exposto em uma mensagem, ele deve ser revogado e substituído imediatamente no GitHub.

## Arquivos principais

- `server/_core/env.ts`
- `server/_core/security.ts`
- `server/_core/index.ts`
- `server/alertEngine.ts`
- `server/workflowRoutes.ts`
- `server/eventBus/sseRoute.ts`
- `server/eventBus/outboxWorker.ts`
- `server/eventBus/outboxWorker.test.ts`
- `drizzle/schema.ts`
- `drizzle/0012_outbox_replay.sql`

## Segunda tranche implementada

### Worker MySQL

Foi criado `server/eventBus/mysqlOutboxStore.ts`, que implementa o contrato `OutboxWorkerStore` com MySQL/Drizzle. A seleção usa transação, `FOR UPDATE SKIP LOCKED`, lease por `locked_until` e identificação por `locked_by`. A atualização da entrega é individual e os estados agregados da Outbox são recalculados após sucesso ou dead letter.

Foi criado `server/eventBus/outboxWorkerMain.ts` como processo separado. O comando de execução é:

```bash
pnpm worker:outbox
```

O build passou a gerar também o bundle do worker. O processo responde a `SIGTERM` e `SIGINT`, usa o transporte HTTP existente para webhooks e o broadcaster existente para SSE.

A migração `drizzle/0012_outbox_replay.sql` cria os campos de lease/retry e a tabela `event_outbox_deliveries`. Deve ser aplicada antes de iniciar o worker em um banco real.

### Isolamento por tenant

As consultas de tipos de alerta, configurações gerais, limpeza operacional, histórico, monitoramento, métricas, assinaturas e atualização do histórico agora combinam `userId` com `tenantId`.

O disparo agendado passa o tenant resolvido da sessão para a busca do `scheduleCronTaskUid`. A atualização de `dispatched_alerts` passou a exigir o tenant no `WHERE`.

Foi criado `server/tenantScope.ts` com guard explícito de pertencimento e `server/tenantScope.test.ts` com testes negativos para:

- recurso de outro tenant;
- tenant vazio;
- recurso nulo ou ausente;
- recurso pertencente ao tenant correto.

### Validação da segunda tranche

A tipagem foi executada novamente com sucesso. A suíte completa deve ser executada antes do merge. O adapter MySQL ainda deve ser validado contra MySQL 8.0/8.4 real, pois testes unitários não substituem a verificação de sintaxe e comportamento de `FOR UPDATE SKIP LOCKED` no banco.

### Próximo passo obrigatório

Antes do merge para produção, executar em ambiente MySQL descartável:

1. `pnpm db:push` ou a migração versionada equivalente.
2. Inserção de duas assinaturas no mesmo evento.
3. Inicialização de dois workers simultâneos.
4. Verificação de que cada entrega é reivindicada por apenas um worker.
5. Simulação de morte do worker e expiração de `locked_until`.
6. Verificação de retry, dead letter e atualização agregada da Outbox.
7. Teste de tentativa de leitura/alteração usando tenant diferente.

## Terceira tranche implementada

### Credenciais inbound

Foi criada a tabela `integration_credentials`, tenant-scoped, com:

- `public_id` público e único;
- `secret_hash` derivado com `scrypt` e salt individual;
- status `active` ou `revoked`;
- expiração opcional;
- relacionamento de rotação (`rotated_from_id`);
- timestamps de criação, revogação e último uso.

O formato apresentado ao integrador é:

```text
in_<public-id>.<secret>
```

O segredo completo é retornado somente na criação ou rotação. A verificação usa comparação em tempo constante. O endpoint inbound exige a credencial hashada. O fallback para a coluna legada `alert_types.api_key` foi removido definitivamente; essa coluna permanece apenas para o segredo de saída do conector ALRT → AXE.

Foram adicionados os procedimentos protegidos:

```text
credentials.createInbound
credentials.rotateInbound
credentials.revokeInbound
```

A migração está em `drizzle/0013_inbound_credentials.sql`.

### Teste HTTP multi-tenant

Foi criado `server/tenantIsolation.integration.test.ts`, que sobe uma aplicação Express real, executa requisições HTTP para dois tenants e comprova que:

- a credencial do tenant A grava somente no tenant A;
- a credencial do tenant B grava somente no tenant B;
- uma credencial desconhecida recebe 401;
- nenhuma ocorrência atravessa o escopo do tenant errado.

### Teste real MySQL 8.0

Foi criado `server/eventBus/mysqlOutboxStore.integration.test.ts`, condicionado à variável `MYSQL_TEST_URL`. O teste cobre dois workers concorrentes e recuperação depois de lease expirado.

O arquivo `docker-compose.mysql8-test.yml` fornece a infraestrutura reproduzível:

```bash
docker compose -f docker-compose.mysql8-test.yml up -d --wait
MYSQL_TEST_URL=mysql://alertas_test:alertas_test@127.0.0.1:13306/central_alertas_test pnpm test -- mysqlOutboxStore.integration.test.ts
docker compose -f docker-compose.mysql8-test.yml down -v
```

Nesta sessão, Docker não está instalado e não havia servidor MySQL 8.0 local. Portanto, o teste real MySQL foi preparado, mas não foi alegado como executado.
