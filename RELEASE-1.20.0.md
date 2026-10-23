# Release 1.20.0 — MUE-017

**Entrega:** classificador de criticidade consultivo, exclusivo do diagnóstico shadow em modo teste.

- `idle` não é interpretado como saudável.
- `healthy` indica amostra dentro da política e sem tendência de degradação.
- `warning` decorre de uma política violada ou de tendência `degrading`.
- `critical` requer `criticalAfterConsecutiveWarnings` avisos consecutivos (1–20) na janela limitada.
- Relatório com razões, últimas violações, contagem, sequência, horário e recuperação.
- O classificador é somente leitura e não gera novas amostras, notificações ou efeitos externos.
- Oito testes automatizados novos.

**Dependência:** MUE-016. **Gate:** PR Draft empilhado; tipagem, testes e build via GitHub Actions; sem merge ou deploy automático.
