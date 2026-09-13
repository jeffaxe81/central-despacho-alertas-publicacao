# Release 1.18.0 — MUE-015

## Entrega

Adiciona um rastreador diagnóstico interno e somente em memória para a cadeia shadow de teste.

### Incluído

- `trackCanonicalShadowDiagnostic()` para obter a avaliação atual e comparar automaticamente com a leitura anterior;
- primeira leitura usada como baseline, sem tendência;
- leituras seguintes retornam o resultado de tendência da MUE-014;
- `resetCanonicalShadowDiagnosticTrackerForTest()` remove apenas a baseline do rastreador;
- nenhuma persistência ou histórico multi-amostra.

## Qualidade

- TDD com RED comprovado antes da implementação;
- GREEN após implementação mínima;
- tipagem, testes automatizados e build de produção validados pelo CI.

## Limites

Sem alteração em dispatcher, `publishEvent()`, HTTP/tRPC, banco, migrations, outbox, webhook, SSE, autenticação, retries ou entrega real.
