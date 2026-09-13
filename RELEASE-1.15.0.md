# Release 1.15.0 — Consumidor diagnóstico interno shadow

## Entregue

Foi criado `createCanonicalShadowDiagnosticReport()` como consumidor interno da fronteira de diagnóstico da MUE-011.

O relatório classifica o shadow como `idle`, `healthy` ou `attention` e apresenta publicações, entregas, falhas, equivalências, divergências, taxa de sucesso de entrega e taxa de equivalência.

## Preservado

A leitura continua restrita a `isTestMode: true`. Não há endpoint HTTP, procedimento tRPC, persistência, banco, migration, outbox, webhook ou SSE adicional. O fluxo produtivo permanece inalterado.

## TDD

O RED foi confirmado antes da implementação. Após a implementação mínima, tipagem, testes e build foram aprovados.

## Próximo passo

MUE-013: política diagnóstica interna de limiares para ambiente de teste.
