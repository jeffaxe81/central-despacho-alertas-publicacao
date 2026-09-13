# Release 1.10.0 — Canal shadow canônico interno

## Entregue

- novo canal interno em memória `server/eventBus/canonicalShadow.ts`;
- API publish/subscribe para consumidores shadow internos;
- transporte do mesmo objeto `canonicalEvent` explícito, sem reconstrução;
- transporte do resultado `equivalent` já calculado pela comparação shadow;
- integração do `deliverToInternalMock()` com o canal somente quando existe `canonicalEvent`;
- isolamento de falhas entre assinantes por `Promise.allSettled()`;
- contagem interna de entregas e falhas por publicação;
- testes unitários do canal e teste de integração mock → canal;
- ADR-0008, README e versão 1.10.0.

## Preservado

- `server/eventBus/publish.ts` sem alteração;
- outbox continua contendo somente o payload legado;
- webhook e SSE continuam recebendo somente o payload legado;
- nenhuma segunda publicação no barramento produtivo;
- nenhum banco ou migration;
- nenhuma chamada HTTP adicional;
- API key, HMAC, retries e validação de endpoint permanecem inalterados;
- sem `canonicalEvent` explícito, nenhum evento é publicado no canal shadow.

## TDD

### Ciclo 1 — contrato do canal

O primeiro teste foi criado antes do módulo e o CI falhou porque `./canonicalShadow` ainda não existia. A implementação mínima adicionou o canal em memória com inscrição, cancelamento e publicação. Durante o GREEN, a checagem de tipos encontrou incompatibilidade de iteração de `Set` com o target atual; a implementação foi ajustada para `Array.from()` sem alterar o comportamento.

### Ciclo 2 — integração com o mock

O teste de integração assinou o canal, chamou `deliverToInternalMock()` com um canônico explícito válido e exigiu o mesmo objeto recebido pelo assinante. O RED mostrou 106 testes anteriores aprovados e somente o novo teste falhando porque nenhuma mensagem havia sido publicada. A implementação mínima adicionou a publicação no caminho já condicionado por `canonicalEvent`.

### Revisão

Foi acrescentada cobertura para um assinante que lança erro: a falha é contabilizada, os demais assinantes continuam recebendo a mensagem e a publicação resolve normalmente.

## Limitação deliberada

O canal shadow é acionado na fronteira do mock interno. Ele ainda não é publicado exatamente na mesma fronteira do `publishEvent()` legado e não atravessa processos ou réplicas.

## Não realizado

- nenhuma persistência canônica;
- nenhum consumidor externo;
- nenhum fan-out canônico por webhook/SSE;
- nenhuma substituição do payload legado;
- nenhuma feature flag produtiva;
- nenhum deploy ou ativação de destino real.

## Próximo passo recomendado

MUE-008: mover a chamada do canal shadow para uma fronteira explícita do dispatcher, ao lado da publicação legada e somente em modo teste, mantendo o barramento produtivo e seus consumidores inalterados.
