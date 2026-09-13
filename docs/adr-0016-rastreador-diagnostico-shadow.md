# ADR-0016 — Rastreador diagnóstico shadow somente em memória

- Status: implementado de forma isolada
- Data: 2026-09-13

## Contexto

A MUE-014 introduziu um comparador puro entre duas avaliações consecutivas da política diagnóstica. Ainda faltava uma fronteira mínima capaz de manter apenas a leitura anterior e aplicar automaticamente essa comparação nas leituras seguintes.

## Decisão

Criar `canonicalShadowDiagnosticTracker.ts`, restrito à cadeia diagnóstica de teste.

O rastreador:

- avalia a política atual da MUE-013;
- mantém somente a última avaliação em memória;
- trata a primeira leitura como baseline, sem tendência;
- a partir da segunda leitura, delega a comparação à MUE-014;
- substitui a baseline pela leitura atual após cada avaliação válida;
- oferece reset explícito apenas para testes.

Uma tentativa inválida ou fora do modo teste falha antes de atualizar a baseline, pois a política é avaliada antes da mutação do estado interno.

## Limites

Não há banco, migration, persistência, histórico multi-amostra, timer, job, HTTP, tRPC, outbox, webhook ou SSE. O fluxo produtivo, autenticação, retries e entrega real permanecem inalterados.

## Consequências

A cadeia diagnóstica passa a oferecer tendência automática entre leituras sucessivas dentro do processo, sem transformar o diagnóstico em funcionalidade produtiva ou persistente.
