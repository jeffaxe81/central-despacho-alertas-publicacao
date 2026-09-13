# ADR-0014 — Política diagnóstica interna por limiares

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-13
- Decisão: avaliar o relatório diagnóstico shadow por uma política configurável pelo chamador, restrita ao modo teste.

## Contexto

A MUE-012 passou a produzir um resumo operacional somente leitura com estado, contadores e taxas derivadas. Ainda faltava uma camada explícita para comparar essas métricas com critérios de aceitação sem codificar valores arbitrários no produto.

## Decisão

Foi criado `server/eventBus/canonicalShadowDiagnosticPolicy.ts` com `evaluateCanonicalShadowDiagnosticPolicy()`.

A política recebe explicitamente:

- `minDeliverySuccessRate`, entre 0 e 1;
- `minEquivalenceRate`, entre 0 e 1;
- `maxFailed`, inteiro maior ou igual a zero;
- `maxDivergent`, inteiro maior ou igual a zero.

O resultado contém o relatório da MUE-012, o estado `idle`, `healthy` ou `warning` e uma lista objetiva de violações. Sem publicações, o estado permanece `idle` e não há violações.

## Limites

Nenhum limiar de negócio é fixado pela plataforma. Os valores são fornecidos pelo chamador e validados antes da avaliação. A leitura continua passando pela proteção de `isTestMode=true` da cadeia MUE-011/MUE-012.

Não foram adicionados endpoint HTTP, procedimento tRPC, banco, migration, persistência, outbox, webhook, SSE ou alteração em `publishEvent()`, autenticação, retries ou entrega real.

## TDD

O CI #113 confirmou RED antes da implementação: tipagem aprovada, 120 testes anteriores aprovados e a nova suíte falhando pela ausência do módulo da política. O CI #114 confirmou GREEN após a implementação mínima, com tipagem, testes e build aprovados.

## Próximo passo recomendado

MUE-014: adicionar um avaliador de tendência diagnóstica somente em memória para comparar leituras sucessivas em ambiente de teste, sem persistência nem integração produtiva.
