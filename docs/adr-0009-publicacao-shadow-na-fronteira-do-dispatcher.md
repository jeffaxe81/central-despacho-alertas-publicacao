# ADR-0009 — Publicação shadow na fronteira do dispatcher

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-12
- Decisão: tornar o dispatcher a única origem da publicação no canal shadow canônico, mantendo o mock como receptor e validador de compatibilidade

## Contexto

A MUE-007 criou um canal interno em memória para transportar o mesmo `canonicalEvent` explícito a consumidores shadow. Naquela etapa, a publicação acontecia dentro de `deliverToInternalMock()`, depois da comparação entre o canônico e o payload legado.

Esse desenho era seguro para validação inicial, mas colocava no mock duas responsabilidades: validar compatibilidade e originar a publicação shadow. O próximo passo é aproximar a origem do evento canônico de sua fronteira natural, `dispatchConfiguredAlert()`, sem alterar o barramento legado nem duplicar a lógica de comparação do adaptador.

## Decisão

`deliverToInternalMock()` continua recebendo, quando aplicável, `canonicalEvent` e `payloadJson`, executando a comparação shadow e retornando `compatibility: { checked, equivalent }`.

O mock não chama mais `publishCanonicalShadowEvent()`.

No fluxo ALRT → AXE em modo teste, `dispatchConfiguredAlert()` aguarda o resultado do mock. Quando existe `canonicalEvent` e o mock retornou `compatibility.checked: true`, o dispatcher publica no canal shadow:

- a mesma referência de `canonicalEvent` produzida antes do mock;
- o mesmo valor `compatibility.equivalent` calculado pelo mock.

A comparação continua existindo em um único lugar. O dispatcher não executa novamente `toAlrtAxeEvent()` e não reconstrói o evento canônico.

## Ordem do fluxo

1. o dispatcher gera ocorrência e payload legado;
2. no modo teste ALRT → AXE, gera também o `canonicalEvent`;
3. `publishEvent()` continua publicando apenas o payload legado no barramento existente;
4. o mock recebe legado + canônico, persiste o recebimento de teste e calcula `compatibility`;
5. o dispatcher recebe o resultado da validação;
6. o dispatcher publica `{ canonicalEvent, equivalent }` no canal shadow interno;
7. histórico e resposta do despacho continuam seguindo o fluxo existente.

## Isolamento e limites

- `server/eventBus/publish.ts` permanece inalterado;
- outbox permanece contendo somente o payload legado;
- webhook e SSE permanecem recebendo somente o payload legado;
- nenhuma segunda chamada a `publishEvent()`;
- nenhuma persistência canônica;
- nenhum banco ou migration;
- nenhuma chamada HTTP adicional;
- API key, HMAC, retries e endpoint real permanecem inalterados;
- o canal shadow permanece somente em memória e não atravessa processos ou réplicas;
- somente o caminho ALRT → AXE em modo teste produz `canonicalEvent` para essa publicação;
- falhas de assinantes são isoladas por `Promise.allSettled()` no canal e não transformam o despacho `202` em falha.

## TDD

A microentrega foi conduzida em dois ciclos principais.

### Ciclo 1 — retirar a origem do mock

Os testes passaram a exigir que chamadas diretas a `deliverToInternalMock()` continuassem calculando `compatibility`, mas não publicassem mensagens no canal shadow. O RED mostrou 107 testes anteriores aprovados e dois testes novos falhando porque o mock ainda entregava uma mensagem ao canal. A implementação mínima removeu somente a publicação do mock, preservando comparação, log e resposta `202`.

### Ciclo 2 — tornar o dispatcher a origem

O teste do dispatcher assinou o canal, executou `dispatchConfiguredAlert()` em modo teste ALRT → AXE e exigiu uma única mensagem com o canônico explícito e `equivalent: true`. O RED mostrou 108 testes aprovados e apenas o novo teste falhando porque nenhuma mensagem era publicada. A implementação mínima adicionou a publicação após o retorno do mock.

A primeira checagem da implementação encontrou apenas um erro de estreitamento de tipos na união entre o retorno do mock e o retorno HTTP. A correção passou a usar o tipo real `Awaited<ReturnType<typeof deliverToInternalMock>>` no ramo de teste, sem mudança de comportamento.

A revisão acrescentou cobertura para garantir que uma exceção de assinante shadow não altera a resposta de sucesso do dispatcher.

## Consequências

O dispatcher passa a ser a fronteira interna de origem do evento shadow, enquanto o mock fica restrito a receber e validar. A arquitetura reduz acoplamento do mock sem antecipar qualquer mudança no barramento produtivo.

O canal continua não durável e exclusivamente de teste. Transformá-lo em publicação canônica persistente ou externa exigirá decisão arquitetural separada.

## Próximo passo recomendado

MUE-009: adicionar observabilidade da publicação shadow no dispatcher, registrando quantidade de assinantes entregues/falhos e os identificadores do evento, ainda sem persistência, sem fan-out externo e sem alterar o resultado do despacho.
