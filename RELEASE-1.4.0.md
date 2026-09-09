# Release 1.4.0 — Contrato canônico de evento v1

## Entregue

- schema Zod tipado para o envelope canônico baseado em CloudEvents 1.0;
- rastreabilidade e repetibilidade obrigatórias;
- trava `axessimulated: true` nesta primeira versão;
- sete testes de contrato;
- ADR-0002 e orientação de validação.

## Preservado

- fluxo atual de geração e despacho;
- contrato ALRT → AXE;
- barramento, outbox, webhook e SSE;
- banco de dados e migrações existentes;
- modo mock e configurações atuais.

## Não realizado

- nenhuma publicação do novo envelope no barramento;
- nenhum adaptador canônico → ALRT/AXE;
- nenhuma migração de banco;
- nenhum deploy ou habilitação produtiva;
- nenhuma alteração em endpoints reais.

## Próxima microentrega recomendada

Criar, por TDD, um adaptador puro do evento canônico v1 para o contrato ALRT → AXE homologado, sem rede e sem substituir ainda o fluxo legado.
