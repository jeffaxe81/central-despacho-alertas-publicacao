# Release 1.8.0 — Canônico explícito como única fonte do shadow

## Entregue

- remoção do fallback `canonicalShadowFromLegacyAxe()` do mock interno;
- comparação shadow condicionada exclusivamente à presença de `canonicalEvent` explícito;
- payload legado sem `canonicalEvent` continua aceito pelo mock com HTTP 202, mas sem `compatibility`;
- canônico explícito inválido continua não bloqueante e retorna `compatibility.checked: true` com `equivalent: false`;
- manutenção da comparação por `toAlrtAxeEvent()` quando o canônico explícito é válido;
- testes atualizados para os três cenários acima;
- ADR-0006 e README atualizados.

## Preservado

- geração do `canonicalEvent` no dispatcher para ALRT → AXE em modo teste;
- contrato legado ALRT → AXE;
- envio HTTP real;
- API key, HMAC, retries e validação de endpoint;
- barramento, outbox, webhook e SSE;
- banco e migrations;
- demais conectores e o handler genérico do mock;
- característica não bloqueante do shadow.

## Não realizado

- nenhuma substituição do payload legado no envio real;
- nenhuma publicação canônica adicional no barramento;
- nenhuma alteração de banco ou migration;
- nenhuma ativação produtiva ou destino real;
- nenhuma feature flag produtiva.

## Evidência TDD

O primeiro CI da MUE-005 foi executado apenas com a mudança de teste e falhou exatamente porque o mock ainda reconstruía um evento canônico a partir do payload legado e retornava `compatibility` mesmo sem `canonicalEvent` explícito. Os 104 testes anteriores continuaram aprovados e somente o novo requisito falhou.

Após a remoção mínima do fallback, a checagem de tipos, a suíte completa e o build voltaram a passar.

## Próximo passo recomendado

MUE-006: tornar o evento canônico explícito também a entrada observável do barramento em modo de teste, mantendo o payload legado em paralelo e sem alterar o envio real, para começar a validar uma fronteira canônica além do mock.
