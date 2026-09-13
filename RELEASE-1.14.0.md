# Release 1.14.0 — Fronteira interna de diagnóstico shadow

## Entregue

Foi criada uma fronteira interna de consulta para o snapshot diagnóstico do canal shadow.

`readCanonicalShadowDiagnosticSnapshot()` exige `isTestMode: true`, devolve uma cópia do snapshot e rejeita consultas fora do modo teste.

## Preservado

Não foi criado endpoint público, rota HTTP ou procedimento tRPC. Banco, migrations, persistência, outbox, webhook, SSE, `publishEvent()`, autenticação, retries e entrega real permanecem inalterados.

## TDD

O RED foi comprovado pelo CI #98 antes da implementação. Após o serviço mínimo, o CI #99 aprovou tipagem, testes e build.

## Próximo passo

MUE-012: conectar a fronteira a um consumidor diagnóstico interno controlado para ambiente de teste, mantendo o isolamento do fluxo produtivo.