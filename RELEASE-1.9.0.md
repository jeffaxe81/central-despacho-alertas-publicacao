# Release 1.9.0 — Observabilidade canônica isolada

## Entregue

- observação estruturada do evento canônico explícito no caminho ALRT → AXE em modo teste;
- novo evento de log `eventbus.canonical_shadow_observed`;
- campos observáveis: `correlationId`, `eventId`, `type`, `simulated` e `equivalent`;
- reutilização do resultado da comparação shadow já executada no mock;
- ausência de observação canônica quando `canonicalEvent` não é informado;
- manutenção do comportamento não bloqueante do mock;
- versão 1.9.0, ADR-0007 e README atualizados.

## Preservado

- `publishEvent()` e o fan-out legado permanecem inalterados;
- outbox continua persistindo somente o payload legado;
- webhook e SSE continuam recebendo somente o payload legado;
- nenhuma segunda publicação é criada;
- nenhum tráfego HTTP adicional é realizado;
- envio real, API key, HMAC, retries e validação de endpoint permanecem inalterados;
- banco e migrations permanecem inalterados.

## TDD

A primeira prova RED confirmou que o barramento existente recebia somente o payload legado e não transportava `canonicalEvent`. Durante a implementação, a alteração direta dos módulos de transporte foi bloqueada pelo controle do conector. O escopo foi então mantido de forma deliberadamente observacional, sem contornar essa proteção e sem alterar o fan-out real.

O RED definitivo exigiu a emissão do evento estruturado `eventbus.canonical_shadow_observed`. A suíte mostrou 104 testes aprovados, 1 novo teste falhando exatamente porque o log ainda não existia e 1 integração externa ignorada. Após a implementação mínima no mock interno, tipagem, testes e build ficaram verdes.

## Não realizado

- nenhuma persistência canônica adicional no outbox;
- nenhum envio do canônico para assinantes webhook ou SSE;
- nenhuma substituição do payload legado;
- nenhuma feature flag produtiva;
- nenhum deploy ou ativação de destino real.

## Próximo passo recomendado

MUE-007: criar um canal shadow interno, somente de teste e sem persistência, para transportar o evento canônico em paralelo ao barramento legado. O canal deve permanecer desacoplado de outbox, webhook e SSE até um novo gate de compatibilidade.
