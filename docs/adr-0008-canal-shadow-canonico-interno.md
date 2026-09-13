# ADR-0008 — Canal shadow canônico interno

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-12
- Decisão: transportar o evento canônico explícito por um canal interno em memória, exclusivo do caminho de teste, sem persistência ou consumidores externos

## Contexto

A MUE-006 tornou o evento canônico observável por log estruturado, mas ainda não existia um mecanismo interno de transporte que permitisse a outros componentes de teste assinarem o mesmo `canonicalEvent` sem depender do payload legado.

O próximo passo precisa criar essa capacidade sem alterar `publishEvent()`, outbox, webhook, SSE, HTTP real, autenticação ou persistência. O canal também deve preservar a identidade do objeto canônico recebido do dispatcher, evitando reconstrução ou uma segunda fonte de verdade.

## Decisão

Foi criado `server/eventBus/canonicalShadow.ts` como um canal publish/subscribe estritamente em memória.

O canal expõe:

- `subscribeCanonicalShadow()` para registrar um assinante interno e obter uma função de cancelamento;
- `publishCanonicalShadowEvent()` para transportar `{ canonicalEvent, equivalent }` aos assinantes atuais;
- `resetCanonicalShadowSubscribersForTest()` para isolamento determinístico da suíte automatizada.

No caminho ALRT → AXE em modo teste, `deliverToInternalMock()` publica no canal o mesmo objeto `canonicalEvent` explícito recebido do dispatcher, junto com o resultado `equivalent` já produzido pela comparação shadow.

## Isolamento de falhas

A publicação usa `Promise.allSettled()` sobre os assinantes registrados. Uma exceção ou rejeição de um assinante é contabilizada como falha e não impede os demais assinantes de receber a mensagem.

O resultado interno da publicação informa apenas as quantidades `delivered` e `failed`. Esse resultado não altera a resposta HTTP do mock e não é persistido.

## Limites de segurança e escopo

- canal disponível somente dentro do processo do servidor;
- nenhum banco ou migration;
- nenhum outbox adicional;
- nenhuma chamada HTTP;
- nenhum webhook ou SSE;
- nenhuma segunda chamada a `publishEvent()`;
- `server/eventBus/publish.ts` permanece inalterado;
- o payload legado continua sendo a única fonte do barramento produtivo;
- o canal só é acionado quando o mock recebe `canonicalEvent` explícito;
- sem `canonicalEvent`, não existe publicação shadow;
- o canal não é durável e não atravessa processos ou réplicas.

## Consequências

A plataforma passa a ter uma fronteira interna real para consumidores shadow de teste, preservando o mesmo evento canônico produzido antes do mock e mantendo o fluxo produtivo totalmente legado.

A principal limitação é intencional: a publicação shadow ainda acontece na fronteira do mock, depois da publicação legada do dispatcher. Portanto, este canal não substitui nem intercepta o barramento e ainda não representa uma publicação canônica na mesma fronteira de `publishEvent()`.

## Validação

A microentrega foi conduzida em ciclos TDD:

1. o primeiro RED mostrou a inexistência do módulo `canonicalShadow`; após a implementação mínima, o canal transportou o mesmo objeto canônico ao assinante;
2. o segundo RED mostrou que `deliverToInternalMock()` ainda não publicava no canal; após a integração mínima, o assinante passou a receber o mesmo `canonicalEvent` explícito e o mesmo resultado `equivalent`;
3. a revisão adicionou cobertura para isolamento de falha entre assinantes.

Tipagem, suíte completa e build de produção devem permanecer verdes antes do merge.

## Próxima microentrega recomendada

MUE-008: mover a chamada do canal shadow para uma fronteira explícita do dispatcher, ao lado da publicação legada e somente em modo teste, mantendo `publishEvent()`, outbox, webhook e SSE inalterados. O mock deve então permanecer apenas como receptor/validador, sem ser a origem da publicação shadow.
