# Release 1.12.0 — Observabilidade da publicação shadow

## Entregue

O dispatcher passou a registrar `eventbus.canonical_shadow_published` após a publicação no canal shadow, incluindo `correlationId`, `eventId`, `type`, `simulated`, `equivalent`, `delivered` e `failed`.

O log usa nível `info` quando não há falhas e `warn` quando `failed > 0`. Falhas de assinantes continuam isoladas e não alteram o `202`.

## Preservado

`publishEvent()`, outbox, webhook, SSE, banco, migrations, HTTP real, autenticação e retries permanecem inalterados. O canal shadow continua somente em memória e restrito ao modo teste.

## TDD

O RED confirmou 110 testes anteriores aprovados e somente os dois novos testes falhando pela ausência do novo evento estruturado. O GREEN passou a registrar o resumo da publicação no dispatcher.

## Próximo passo

MUE-010: snapshot diagnóstico em memória do canal shadow para ambiente de teste, sem persistência e sem alterar o barramento legado.
