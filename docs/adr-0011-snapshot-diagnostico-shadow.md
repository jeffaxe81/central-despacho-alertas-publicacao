# ADR-0011 — Snapshot diagnóstico do canal shadow

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-12
- Decisão: manter um snapshot diagnóstico cumulativo, somente em memória, dentro do canal shadow canônico.

## Contexto

A MUE-009 passou a registrar no dispatcher o resultado de cada publicação shadow com as contagens `delivered` e `failed`. Esses registros permitem observar uma publicação individual, mas ainda não existia uma visão cumulativa do comportamento do canal durante uma execução de teste.

## Decisão

O módulo `server/eventBus/canonicalShadow.ts` passa a manter um snapshot em memória com:

- `publications`: quantidade de publicações realizadas no canal shadow;
- `delivered`: soma das entregas concluídas aos assinantes;
- `failed`: soma das falhas isoladas de assinantes;
- `equivalent`: quantidade de publicações cuja comparação com o legado foi equivalente;
- `divergent`: quantidade de publicações cuja comparação divergiu.

A função `getCanonicalShadowDiagnosticSnapshot()` devolve uma cópia somente de leitura dos contadores atuais. O reset usado pelos testes limpa assinantes e também reinicializa o snapshot.

## Limites

O snapshot não é persistido e não é propagado entre processos ou réplicas. Nenhum banco, migration, outbox, webhook, SSE ou chamada HTTP foi adicionado. `publishEvent()` e o fluxo produtivo legado permanecem inalterados.

## TDD

O primeiro commit adicionou somente os testes do novo comportamento. O CI #92 passou na checagem de tipos e falhou na etapa de testes antes da implementação. Depois do código mínimo, o CI #93 aprovou tipagem, testes e build de produção.

Os testes comprovam o acúmulo de publicações, entregas, falhas, equivalências e divergências, além da reinicialização do diagnóstico junto com o reset do canal.

## Próximo passo recomendado

MUE-011: disponibilizar esse snapshot por uma fronteira interna de consulta somente leitura e restrita ao ambiente de teste, sem persistência e sem expor o canal shadow ao fluxo produtivo.
