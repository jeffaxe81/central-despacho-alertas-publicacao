# Release 1.13.0 — Segurança de segredos, limites de requisição e retenção

## Corrigido

- **Chave de assinante exposta:** a listagem de assinaturas devolvia `subscriberApiKey` ao navegador. Agora a listagem não contém segredos, apenas `hasOutboundApiKey`.
- **Segredos em texto puro:** `api_key`, `auth_token` e `outbound_api_key` passam a ser cifrados com AES-256-GCM. Chaves de entrada e de assinante são buscadas por digest HMAC-SHA256.
- **Autenticação de entrada:** a busca de API key de ocorrências não compara mais o valor em claro no banco.
- **SSE:** a chave na query string (`?api_key=`) fica desativada por padrão. O canal interno passa a usar o id da assinatura.
- **Força bruta:** login e cadastro têm limite de tentativas por IP.
- **Crescimento do outbox:** registros finalizados são removidos após `EVENT_OUTBOX_RETENTION_DAYS` dias (padrão 30).
- **Tipagem:** removidos casts `any` em `routers.ts` e `storage.ts`.

## Migração e operação

1. Defina `SECRETS_ENCRYPTION_KEY` (mínimo 32 caracteres) no ambiente. Sem ela, o servidor não inicia em produção.
2. Rode as migrações (`0012_seguranca_segredos_digest.sql`): adiciona `api_key_digest` e `subscriber_key_digest`, e torna `subscriber_api_key` anulável.
3. Na primeira inicialização, o backfill cifra os segredos existentes, calcula os digests e apaga as chaves de assinante em claro. Ele é idempotente e o log registra quantos registros foram convertidos.
4. Se algum cliente usava `?api_key=` no SSE, defina `SSE_ALLOW_QUERY_API_KEY=true` ou migre para o header `Authorization: Bearer`.

## Limitações declaradas

- **Backfill não coberto por teste automatizado:** exige MySQL real. Foi validado por revisão de código; recomenda-se rodar em homologação com uma cópia do banco antes da produção.
- **Rate limit em memória:** com várias instâncias, o limite efetivo é multiplicado pelo número de instâncias.
- **Rotação de `SECRETS_ENCRYPTION_KEY`:** não implementada. Trocar a chave exige reinserir os segredos.
- **Coluna `subscriber_api_key`:** permanece no schema (sempre nula após o backfill) para manter compatibilidade de rollback. Uma migração futura pode removê-la.
- **Não cobertos nesta release:** broker de mensageria real (ADR-0001), SSE com várias instâncias, contrato oficial do CRM e validação do build Docker.

## Testes

Suíte: 140 testes aprovados e 1 pulado (o teste de saúde do AXE, condicional a ambiente). Novos testes em `secrets`, `rateLimit`, `retention`, `sseRoute` e na visão segura de assinaturas.
