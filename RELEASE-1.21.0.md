# Release 1.21.0 — MUE-018

**Objetivo:** controle interno de incidentes diagnósticos e deduplicação de observações em modo teste.

- Incidente único ativo por processo de teste, com identificação sequencial volátil.
- Releituras de uma mesma amostra não criam incidentes duplicados.
- Avisos repetidos geram contagem de observações suprimidas; mudança de criticidade produz transição explícita.
- Reconhecimento de incidentes ativos, idempotente, com reabertura do reconhecimento se houver escalonamento.
- Recuperação marca a última ocorrência como resolvida com timestamp; nova falha abre um novo incidente.
- Estados defensivos e tratamento de sequências retrocedidas.
- 11 testes unitários de fluxos, segurança e regressão.

**Dependência:** MUE-017 (#18), empilhada na cadeia anterior. **Sem** notificações externas, interfaces, persistência, alterações de despacho ou deploy.

**Gate:** CI de tipagem, testes completos e build; manter PR Draft até homologação.
