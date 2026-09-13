# ADR-0013 — Consumidor diagnóstico interno shadow

- Status: implementado de forma isolada
- Data: 2026-09-13
- Decisão: consumir a fronteira interna da MUE-011 para gerar um resumo operacional somente em modo teste.

## Decisão

`createCanonicalShadowDiagnosticReport()` lê o snapshot pela fronteira existente e calcula os estados `idle`, `healthy` e `attention`, além das taxas de sucesso de entrega e equivalência.

A função é somente leitura e mantém o bloqueio quando `isTestMode` não está ativo.

## Limites

Nenhuma rota HTTP ou tRPC foi criada. Não há banco, migration, persistência, outbox, webhook ou SSE adicional. O fluxo produtivo permanece inalterado.

## TDD

Os testes foram escritos antes da implementação. O RED foi confirmado no CI e o GREEN foi confirmado após a implementação mínima.

## Próximo passo recomendado

MUE-013: política diagnóstica interna de limiares para ambiente de teste.
