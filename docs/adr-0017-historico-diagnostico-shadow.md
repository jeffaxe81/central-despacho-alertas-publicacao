# ADR-0017 — Janela limitada de histórico diagnóstico shadow (MUE-016)

## Contexto
A MUE-015 compara apenas a leitura anterior com a atual. Para investigar tendências em testes, é útil consultar uma pequena janela recente sem expor dados operacionais ou introduzir banco, fila e rede.

## Decisão
- Criar `canonicalShadowDiagnosticHistory.ts` como consumidor interno da MUE-015.
- Registrar explicitamente cada avaliação por `recordCanonicalShadowDiagnosticSample()` somente em modo teste.
- Reter em memória apenas as **20 amostras mais recentes** (FIFO), com número sequencial local e horário de observação.
- Expor `readCanonicalShadowDiagnosticHistory()` com cópia defensiva e `summarizeCanonicalShadowDiagnosticHistory()` com contagem de `idle`, `warning`, `improving` e `degrading`.
- O reset da janela não reinicia o snapshot do canal shadow nem a baseline da MUE-015.

## Limites e segurança
Amostragem por chamada explícita, sem agendamento automático. Dados voláteis e locais ao processo, sem persistência, sem multi-réplica, sem acesso HTTP/tRPC e sem alteração de credenciais, assinaturas, retries, webhook, SSE, Outbox, ALRT→AXE ou produção. Estado vazio não significa que o sistema esteja saudável; apenas que não há amostras nesta janela.

## Testes
Cobrir a primeira baseline, regressão, janela FIFO, resumo, leitura defensiva, proibição em produção, validação prévia e reset independente.

## Continuidade
Somente após homologação, avaliar painel operacional de diagnóstico e alertas, com isolamento de domínios/tenants e política explícita de retenção.
