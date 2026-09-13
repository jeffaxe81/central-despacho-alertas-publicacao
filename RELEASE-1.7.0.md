# Release 1.7.0 — Geração canônica antes do mock

## Entregue

- geração do evento canônico dentro de `dispatchConfiguredAlert()` antes da fronteira do mock;
- escopo restrito ao conector ALRT → AXE em modo teste;
- envio paralelo de `canonicalEvent` e `payloadJson` ao mock interno;
- equivalência comprovada por `toAlrtAxeEvent(canonicalEvent) === payload legado`;
- manutenção do fallback shadow da MUE-003 para compatibilidade;
- novo teste `alertEngine.canonicalFirst.test.ts`;
- ADR-0005 e documentação atualizada.

## Preservado

- contrato legado ALRT → AXE;
- envio HTTP real;
- API key, HMAC, retries e validação de endpoint;
- barramento, outbox, webhook e SSE;
- banco e migrations;
- comportamento de conectores diferentes de AXE;
- resposta não bloqueante do mock em caso de divergência shadow.

## Não realizado

- nenhuma substituição do payload legado no envio real;
- nenhuma publicação canônica adicional no barramento;
- nenhuma feature flag produtiva;
- nenhum deploy ou ativação de destino real;
- nenhuma remoção do fallback de reconstrução canônica da MUE-003.

## Evidência TDD

O teste inicial foi executado antes da implementação e falhou exatamente porque `canonicalEvent` era `undefined` na chamada ao mock, enquanto os testes existentes continuaram verdes. Após a implementação, a checagem de tipos, a suíte completa e o build passaram.

Durante a revisão, uma implementação intermediária com wrapper isolado foi refatorada para eliminar duplicação de código. O resultado final altera somente o dispatcher existente e o teste específico, além da documentação e versionamento.

## Próximo passo recomendado

MUE-005: retirar o fallback que reconstrói o canônico a partir do payload legado dentro do mock, fazendo com que a comparação shadow dependa exclusivamente do evento canônico explícito gerado pelo dispatcher no modo teste ALRT → AXE.
