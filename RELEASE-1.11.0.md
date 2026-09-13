# Release 1.11.0 — Publicação shadow na fronteira do dispatcher

## Entregue

- origem da publicação do canal shadow movida de `deliverToInternalMock()` para `dispatchConfiguredAlert()`;
- mock permanece responsável pela comparação canônico × legado e pelo retorno de `compatibility`;
- dispatcher publica o mesmo `canonicalEvent` explícito somente após a validação do mock;
- `equivalent` publicado no canal é exatamente o valor retornado pelo mock;
- nenhuma reconstrução canônica e nenhuma segunda execução do adaptador no dispatcher;
- falhas de assinantes shadow continuam isoladas e não alteram o `202` do despacho;
- testes atualizados para separar as responsabilidades do mock e do dispatcher;
- ADR-0009, README e versão 1.11.0 atualizados.

## Preservado

- `server/eventBus/publish.ts` sem alteração;
- outbox permanece somente legado;
- webhook e SSE permanecem somente legado;
- nenhuma segunda chamada a `publishEvent()`;
- nenhuma persistência canônica;
- nenhum banco ou migration;
- nenhuma chamada HTTP adicional;
- API key, HMAC, retries e entrega real permanecem inalterados;
- canal shadow continua somente em memória e exclusivo do caminho de teste.

## TDD

### Ciclo 1 — mock deixa de originar a publicação

O primeiro RED alterou somente o contrato de teste do mock. O CI mostrou 107 testes aprovados e dois testes novos falhando porque chamadas diretas a `deliverToInternalMock()` ainda entregavam uma mensagem ao canal shadow. A implementação mínima removeu a chamada de publicação do mock, mantendo comparação, observabilidade estruturada e `compatibility`.

O CI seguinte ficou verde com tipagem, testes e build aprovados.

### Ciclo 2 — dispatcher assume a origem

O segundo RED assinou o canal e executou `dispatchConfiguredAlert()` no modo teste ALRT → AXE. O CI mostrou 108 testes aprovados e apenas o novo teste falhando porque o dispatcher entregava zero mensagens shadow.

A implementação mínima adicionou a publicação após o retorno do mock, reutilizando o `canonicalEvent` já existente e `compatibility.equivalent` retornado pela validação.

A primeira checagem da implementação identificou somente um erro de tipagem na união entre o retorno do mock e o retorno HTTP. O ramo de teste passou a usar `Awaited<ReturnType<typeof deliverToInternalMock>>`, sem alteração de lógica.

Após a correção, TypeScript, testes e build ficaram verdes. A revisão também acrescentou um teste garantindo que um assinante shadow que lança erro não converte o despacho `202` em falha.

## Limites deliberados

O canal shadow ainda é local ao processo e não durável. Não existe publicação canônica em outbox, webhook ou SSE, nem consumidor externo.

A publicação shadow ocorre depois que o mock valida a compatibilidade. Essa ordem é intencional nesta fase, pois preserva uma única fonte para o cálculo de equivalência.

## Não realizado

- nenhuma substituição do payload legado;
- nenhum fan-out canônico externo;
- nenhuma persistência canônica;
- nenhuma feature flag produtiva;
- nenhum deploy ou ativação de destino real.

## Próximo passo recomendado

MUE-009: adicionar observabilidade da publicação shadow na fronteira do dispatcher, registrando `delivered`/`failed` retornados pelo canal e os identificadores do evento, mantendo a operação não bloqueante e sem persistência adicional.
