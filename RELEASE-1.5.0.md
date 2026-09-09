# Release 1.5.0 — Adaptador canônico ALRT → AXE

## Entregue

- função pura `toAlrtAxeEvent`;
- validação do envelope canônico e da projeção AXE;
- conversão exata para `alert.received`;
- preservação de correlação e idempotência;
- mapeamento de severidade e validação de coordenadas;
- seis testes automatizados;
- ADR-0003 e documentação operacional.

## Preservado

- contrato ALRT → AXE homologado;
- geração, dispatcher e barramento atuais;
- outbox, webhook, SSE e modo mock;
- banco, migrações e endpoints existentes.

## Não realizado

- nenhuma chamada HTTP;
- nenhuma integração do adaptador com o fluxo legado;
- nenhuma migração de banco;
- nenhum deploy ou habilitação produtiva;
- nenhuma criação de alerta no AXE.

## Próxima microentrega recomendada

Publicar o evento canônico apenas no mock interno e comparar, em teste, a saída do adaptador com o payload legado, sem destino real.
