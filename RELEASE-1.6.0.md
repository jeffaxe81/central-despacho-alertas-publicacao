# Release 1.6.0 — Shadow canônico no mock interno

## Entregue

- validação shadow do contrato canônico no mock interno;
- reconhecimento automático do envelope ALRT → AXE `alert.received` em modo teste;
- reconstrução de evento canônico sintético somente para comparação;
- projeção pelo adaptador `toAlrtAxeEvent`;
- comparação profunda entre a projeção canônica e o payload legado;
- retorno de `compatibility.checked` e `compatibility.equivalent` como evidência de equivalência;
- teste unitário do mock e teste de integração do dispatcher em modo teste;
- ADR-0004.

## Preservado

- fluxo legado de geração e entrega;
- contrato ALRT → AXE homologado;
- dispatcher de destino real;
- barramento, outbox, webhook e SSE;
- banco, migrations e credenciais;
- comportamento do mock para payloads que não sejam `alert.received`.

## Não realizado

- nenhuma chamada HTTP adicional;
- nenhuma publicação canônica no barramento;
- nenhuma substituição do payload legado;
- nenhuma feature flag produtiva;
- nenhum deploy ou habilitação de destino real.

## Evidência TDD

A implementação foi conduzida em dois ciclos RED → GREEN. Primeiro, o mock foi obrigado por teste a retornar a evidência de compatibilidade. Depois, o fluxo `dispatchConfiguredAlert()` em modo teste ALRT → AXE foi obrigado por teste a produzir a mesma evidência. A checagem de tipos, a suíte completa e o build foram aprovados antes do fechamento documental.

## Próxima microentrega recomendada

MUE-004: gerar o evento canônico antes da fronteira do mock e enviá-lo explicitamente junto do payload legado no caminho de teste. O objetivo é evoluir gradualmente para `canonical-first` sem alterar ainda a entrega real.
