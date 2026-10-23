# ADR-0019 — Controle de incidentes internos e deduplicação shadow (MUE-018)

## Contexto
A MUE-017 calcula criticidade, mas leituras repetidas de um mesmo diagnóstico podem ser interpretadas por uma interface como novas ocorrências. Um registro de incidente em memória permite distinguir abertura, repetição, agravamento, redução de gravidade e recuperação sem enviar alertas reais.

## Decisão
- Adicionar `canonicalShadowDiagnosticIncidentTracker.ts` em cima do avaliador MUE-017.
- Processar somente a **nova sequência de amostra** MUE-016. Releituras idênticas são devolvidas como `suppressed` sem gerar nova ocorrência.
- Manter **um incidente ativo** e **a última ocorrência resolvida**, locais ao processo. IDs são contadores locais não duráveis.
- Transições: `opened`, `suppressed`, `escalated`, `deescalated`, `recovered`, `none` e `stale`.
- Repetições de gravidade igual incrementam `suppressedObservations` quando existe amostra nova; uma nova consulta à mesma sequência não incrementa.
- Permitir `acknowledgeCanonicalShadowDiagnosticIncident()` somente para o ID do incidente ativo, sem duplicar o reconhecimento; em agravamento, o reconhecimento é limpo para exigir nova ação.
- Em `healthy`, o incidente ativo é resolvido, com horário. Em `idle`, **não** se presume recuperação.
- Uma sequência retrocedida (por reset do histórico) retorna `stale`; o rastreador deve ser reiniciado explicitamente junto com a janela de teste.

## Restrições
Sem qualquer persistência, operação distribuída, notificações, novos canais de comunicação, APIs, UI, tRPC, banco/migration, event bus produtivo, Outbox, webhook, SSE ou AXE Dispatch. O rastreador e os IDs existem somente no processo e não podem ser usados para coordenar tenants, máquinas ou réplicas. A fronteira `isTestMode` protege todas as leituras/mutações públicas.

## Testes
Vazio, abertura, leitura duplicada, amostras repetidas, reconhecimento idempotente, agravamento, redução, recuperação, reabertura, resets de sequência, validação do modo teste, cópia defensiva e ausência de mutação no histórico shadow.
