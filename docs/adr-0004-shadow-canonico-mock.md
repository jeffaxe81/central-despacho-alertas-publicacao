# ADR-0004 — Shadow canônico no mock interno

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-12
- Decisão: validar a equivalência entre o contrato canônico e o payload legado ALRT → AXE exclusivamente no mock interno

## Contexto

O Motor Universal de Eventos já possui o contrato canônico v1 e o adaptador puro `toAlrtAxeEvent`, porém o fluxo de entrega existente ainda gera o envelope legado ALRT → AXE. Substituir esse fluxo diretamente aumentaria o risco antes de existir evidência de equivalência entre as duas representações.

## Decisão

Quando o mock interno recebe um payload de teste com `eventType: "alert.received"`, ele executa uma validação shadow sem efeitos externos:

1. reconhece o envelope legado ALRT → AXE;
2. reconstrói um evento canônico sintético `simulation-only` com os mesmos campos relevantes;
3. projeta esse evento novamente pelo adaptador `toAlrtAxeEvent`;
4. compara a projeção canônica com o payload legado por igualdade profunda;
5. devolve o resultado em `compatibility.checked` e `compatibility.equivalent`.

Se o mock receber outro tipo de payload, o comportamento anterior é preservado e nenhuma comparação canônica é executada. Se a projeção canônica for inválida ou divergente, a validação shadow registra `equivalent: false`, mas não bloqueia a aceitação do mock nem altera o resultado legado `202`.

## Limites de segurança

- nenhuma chamada HTTP real é criada pela validação shadow;
- nenhum destino produtivo é habilitado;
- nenhum banco, migration ou credencial é alterado;
- o barramento e o outbox permanecem inalterados;
- o dispatcher real continua usando o contrato legado;
- divergências do shadow não interrompem o fluxo legado;
- o contrato canônico continua restrito a eventos sintéticos (`axessimulated: true`).

## Consequências

A solução passa a produzir evidência automatizada de compatibilidade antes de mover a geração canônica para uma camada anterior do fluxo. A comparação ocorre na fronteira do mock e, portanto, ainda não representa uma arquitetura `canonical-first` em runtime.

Essa limitação é intencional: a MUE-003 valida equivalência com baixo risco, sem alterar o caminho de entrega real. Uma divergência serve como sinal de diagnóstico, não como mecanismo de bloqueio.

## Validação

- teste unitário do mock com evento canônico explícito;
- teste de integração do `dispatchConfiguredAlert()` em modo teste ALRT → AXE;
- teste de divergência garantindo que erro da projeção não bloqueie o mock;
- checagem de tipos com `tsc --noEmit`;
- suíte automatizada completa;
- build de produção.

## Próxima microentrega recomendada

Gerar o evento canônico antes da fronteira do mock e passá-lo explicitamente ao caminho de teste, mantendo o payload legado em paralelo. Somente após nova evidência de equivalência deve ser avaliada uma feature flag para shadow no dispatcher, ainda sem substituir a entrega real.
