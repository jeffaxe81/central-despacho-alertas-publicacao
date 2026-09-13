# ADR-0006 — Canônico explícito como única fonte da comparação shadow

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-12
- Decisão: remover do mock a reconstrução canônica derivada do payload legado e comparar apenas eventos canônicos recebidos explicitamente

## Contexto

A MUE-003 introduziu uma validação shadow segura reconstruindo, dentro do mock, um evento canônico equivalente a partir do payload legado ALRT → AXE. A MUE-004 moveu a geração do evento canônico para antes da fronteira do mock, fazendo com que o dispatcher passe `canonicalEvent` e `payloadJson` em paralelo no modo teste.

Após a MUE-004, manter a reconstrução dentro do mock criava duas fontes possíveis para o canônico: a fonte explícita produzida pelo dispatcher e uma fonte derivada do próprio legado. Isso poderia mascarar falhas futuras na geração canônica do dispatcher.

## Decisão

O mock interno passa a:

1. persistir o payload legado recebido exatamente como antes;
2. executar a comparação shadow somente quando `canonicalEvent` estiver presente;
3. projetar esse canônico explícito por `toAlrtAxeEvent()`;
4. comparar a projeção com o payload legado;
5. não criar `compatibility` quando receber apenas o payload legado;
6. manter a resposta HTTP 202 mesmo quando o canônico explícito for inválido, registrando `equivalent: false`.

A função `canonicalShadowFromLegacyAxe()` é removida.

## Consequências

### Positivas

- o dispatcher torna-se a única origem do evento canônico usado no shadow;
- uma falha na geração ou propagação do canônico deixa de ser mascarada pelo mock;
- a separação entre contrato canônico e contrato legado fica mais explícita;
- o comportamento continua não bloqueante e seguro para homologação.

### Limites

- o payload legado continua sendo a entrada do envio real;
- o barramento, outbox, webhook e SSE ainda recebem o payload atual;
- o handler HTTP genérico do mock não gera canônico por conta própria;
- não há alteração de autenticação, API key, HMAC, retries, banco ou migrations.

## Validação

A microentrega segue TDD. O teste RED provou que, antes da mudança, um `alert.received` sem `canonicalEvent` ainda recebia `compatibility` porque o fallback reconstruía o canônico. Após a remoção do fallback, a suíte comprova que:

- sem `canonicalEvent`, não existe comparação shadow;
- com canônico válido, a equivalência continua sendo verificada;
- com canônico explícito inválido, o mock continua retornando 202 e `equivalent: false`;
- os demais testes permanecem verdes.

## Próxima microentrega recomendada

MUE-006: introduzir observabilidade do evento canônico no barramento em modo de teste, em paralelo ao payload legado e sem alterar o envio real, preparando uma migração canônica controlada para além da fronteira do mock.
