# ADR-0015 — Tendência diagnóstica do canal shadow

## Contexto

A MUE-013 produz uma avaliação pontual da saúde diagnóstica com limiares fornecidos pelo chamador. Faltava comparar duas leituras sucessivas sem criar histórico persistente nem pesos arbitrários entre métricas.

## Decisão

Criar `compareCanonicalShadowDiagnosticTrend()` como função pura que recebe os resultados `previous` e `current` da política da MUE-013.

A comparação considera:

- `deliverySuccessRate`: maior é melhor;
- `equivalenceRate`: maior é melhor;
- `failed`: menor é melhor;
- `divergent`: menor é melhor;
- quantidade de violações: menor é melhor.

A tendência será:

- `improving` quando houver ao menos uma melhora e nenhuma piora;
- `degrading` quando houver ao menos uma piora e nenhuma melhora;
- `stable` quando não houver mudança, houver sinais mistos ou alguma leitura estiver `idle`.

Os motivos da classificação são retornados explicitamente. O comparador não grava estado; o chamador fornece as duas leituras.

## Consequências

A regra evita pontuação ou pesos implícitos entre métricas e mantém o recurso determinístico, testável e desacoplado. Não há persistência, banco, nova rota, chamada de rede ou alteração no fluxo produtivo.

## Validação

A implementação segue TDD: CI #119 em RED antes do módulo existir e CI #120 em GREEN após o código mínimo.
