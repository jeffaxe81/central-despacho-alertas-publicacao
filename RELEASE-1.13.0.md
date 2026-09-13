# Release 1.13.0 — Snapshot diagnóstico do canal shadow

## Entregue

O canal shadow canônico passou a manter um snapshot diagnóstico cumulativo somente em memória com `publications`, `delivered`, `failed`, `equivalent` e `divergent`.

A nova função `getCanonicalShadowDiagnosticSnapshot()` devolve uma cópia somente de leitura dos contadores atuais. O reset de teste do canal também reinicializa o snapshot, preservando isolamento entre cenários.

## Preservado

`publishEvent()`, outbox, webhook, SSE, banco, migrations, HTTP real, autenticação e retries permanecem inalterados. O diagnóstico não é persistido e continua restrito ao processo em memória do caminho shadow.

## TDD

O RED foi produzido pelo commit de testes antes da implementação. O CI #92 falhou na etapa de testes, como esperado. Após a implementação mínima, o CI #93 aprovou tipagem, testes e build.

## Próximo passo

MUE-011: expor o snapshot por uma fronteira interna de consulta somente leitura para ambiente de teste, mantendo o fluxo produtivo isolado.
