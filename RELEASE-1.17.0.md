# Release 1.17.0

MUE-014 adiciona comparação de tendência entre duas leituras consecutivas da política diagnóstica shadow.

## Entregue

- `compareCanonicalShadowDiagnosticTrend()` como comparador puro;
- tendências `stable`, `improving` e `degrading`;
- comparação de taxa de sucesso de entrega, taxa de equivalência, falhas, divergências e quantidade de violações;
- leituras `idle` tratadas como sem base comparável suficiente;
- sinais mistos classificados como `stable`, sem atribuir pesos arbitrários às métricas.

## Limites

O recurso permanece somente em memória e não adiciona persistência, rotas HTTP/tRPC nem mudanças no fluxo produtivo.

## Qualidade

- CI #119: RED antes da implementação;
- CI #120: GREEN após implementação mínima;
- verificação final registrada no PR da MUE-014.
