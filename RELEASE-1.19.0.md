# Release 1.19.0 — MUE-016

**Escopo:** histórico diagnóstico em memória do canal shadow, exclusivamente em modo teste.

- Janela FIFO de 20 amostras, com sequência e timestamp.
- Retenção das avaliações de limiares e tendências da MUE-015.
- Resumo de estados `idle`/`warning` e tendências `improving`/`degrading`.
- Leitura com cópias defensivas.
- Bloqueio fora de modo teste, sem side effects no caminho produtivo.
- Testes unitários para retenção, resumo, isolamento, validação e reset.

**Sem alteração de**: banco, migrations, endpoints, Outbox, webhook, SSE, autenticação, integração ALRT→AXE ou deploy.

**Dependência:** PR MUE-015. Esta entrega deve permanecer em Draft até a validação/integração da cadeia anterior.
