# Release 1.16.0 — Política diagnóstica shadow por limiares

## Entregue

A MUE-013 adiciona `evaluateCanonicalShadowDiagnosticPolicy()` sobre o relatório interno da MUE-012.

A política recebe limiares explicitamente configurados pelo chamador, valida os valores e classifica o diagnóstico como `idle`, `healthy` ou `warning`, retornando também as violações encontradas.

## Critérios configuráveis

- `minDeliverySuccessRate`;
- `minEquivalenceRate`;
- `maxFailed`;
- `maxDivergent`.

A plataforma não fixa valores de negócio para esses critérios.

## Preservado

A política continua restrita a `isTestMode=true`. Não foram criados endpoint HTTP, procedimento tRPC, banco, migration, persistência, outbox, webhook ou SSE. `publishEvent()`, autenticação, retries e entrega real permanecem inalterados.

## TDD

O CI #113 produziu RED antes da implementação. O CI #114 confirmou GREEN após o código mínimo, com tipagem, testes e build aprovados.

## Próximo passo

MUE-014: avaliar tendência entre leituras diagnósticas sucessivas somente em memória no ambiente de teste.
