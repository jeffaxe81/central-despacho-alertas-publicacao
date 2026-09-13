# ADR-0012 — Fronteira interna de consulta do diagnóstico shadow

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-12
- Decisão: encapsular a leitura do snapshot diagnóstico shadow em uma fronteira interna que exige `isTestMode: true`.

## Contexto

A MUE-010 introduziu um snapshot cumulativo somente em memória no canal shadow. O getter do módulo é útil internamente, mas ainda não existia uma fronteira explícita para separar a consulta diagnóstica do restante do fluxo e bloquear seu uso fora do modo teste.

## Decisão

Foi criado `server/eventBus/canonicalShadowDiagnostics.ts` com `readCanonicalShadowDiagnosticSnapshot()`.

A função:

- exige explicitamente `isTestMode: true`;
- rejeita a consulta quando o modo teste não está ativo;
- delega a leitura ao snapshot da MUE-010;
- retorna uma cópia do estado diagnóstico, sem expor referência mutável;
- não cria rota HTTP, endpoint tRPC ou qualquer interface pública.

## Limites

Nenhum banco, migration, persistência, outbox, webhook, SSE ou chamada HTTP foi adicionado. `publishEvent()`, autenticação, retries e entrega real permanecem inalterados.

A fronteira é exclusivamente interna e não habilita diagnóstico shadow em fluxo produtivo.

## TDD

O RED foi produzido com testes antes da implementação. O CI #98 passou na checagem de tipos e falhou na suíte automatizada antes da criação do serviço. Após a implementação mínima, o CI #99 aprovou tipagem, testes e build.

Os testes comprovam que a consulta funciona em modo teste, devolve cópia defensiva e é rejeitada quando `isTestMode=false`.

## Próximo passo recomendado

MUE-012: integrar essa fronteira a um consumidor diagnóstico interno controlado para ambiente de teste, sem criar exposição produtiva nem persistência.