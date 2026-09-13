# ADR-0010 — Observabilidade da publicação shadow no dispatcher

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-12
- Decisão: registrar no dispatcher o resultado da publicação do canal shadow canônico.

## Contexto

A MUE-008 tornou `dispatchConfiguredAlert()` a origem da publicação shadow. O canal já retorna `{ delivered, failed }`, mas esse resultado ainda não era registrado na fronteira do dispatcher.

## Decisão

Após `publishCanonicalShadowEvent()`, o dispatcher registra `eventbus.canonical_shadow_published` com `correlationId`, `eventId`, `type`, `simulated`, `equivalent`, `delivered` e `failed`.

O log usa nível `info` quando `failed === 0` e `warn` quando `failed > 0`.

Falhas de assinantes permanecem não bloqueantes e não alteram o `202` do despacho.

## Limites

`publishEvent()`, outbox, webhook, SSE, banco, migrations, HTTP real, autenticação e retries permanecem inalterados. O canal shadow continua somente em memória e restrito ao caminho de teste.

## TDD

O RED adicionou dois testes: um para `delivered: 1, failed: 0` em nível `info` e outro para `delivered: 0, failed: 1` em nível `warn`, preservando `202`. O CI confirmou que somente esses dois testes falhavam antes da implementação. O GREEN passou a capturar o retorno do canal e registrá-lo via `logEvent()`.

## Próximo passo recomendado

MUE-010: adicionar um snapshot diagnóstico em memória do canal shadow para ambiente de teste, sem persistência e sem alterar o barramento legado.
