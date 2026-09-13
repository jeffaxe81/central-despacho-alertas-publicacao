# Auditoria final — tenantId, Outbox e credenciais

## Resultado

A auditoria da camada de dados e dos fluxos de integração foi concluída na branch `hardening/production-readiness`.

## Queries auditadas e protegidas

As consultas abaixo passaram a usar `tenantId` explicitamente ou um identificador globalmente único que não permite colisão entre tenants:

| Operação | Proteção |
|---|---|
| Listagem de alert types | `userId + tenantId` |
| Configurações gerais | `userId + tenantId` |
| Limpeza operacional | `userId + tenantId` em cada tabela |
| Alert type por usuário | `id + userId + tenantId` |
| Alert type por tarefa agendada | `scheduleCronTaskUid + tenantId` obrigatório |
| Deduplicação de ocorrência | `alertTypeId + tenantId + externalId` |
| Atualização de alert type | `id + userId + tenantId` |
| Histórico de despacho | `userId + tenantId` |
| Monitoramento de workflow | `userId + tenantId` |
| Métricas | `userId + tenantId` |
| Atualização de despacho | `id + tenantId` obrigatório |
| Atualização da Outbox | `id + tenantId` obrigatório |
| Assinaturas por usuário | `userId + tenantId` |
| Ativação de assinatura | `id + userId + tenantId` |
| Assinaturas por evento | `tenantId + categoria` |
| Credenciais inbound | `publicId + status`, seguido de validação do alert type por `userId + tenantId` |

A busca por `subscriberApiKey` continua sem tenant no `WHERE` porque esse identificador possui índice `UNIQUE` global. Após a identificação da assinatura, todas as operações de evento usam o tenant da assinatura.

## Credenciais legadas

O caminho inbound baseado em `alert_types.api_key` foi removido definitivamente do workflow. O recebimento agora exige `authenticateInboundCredential()` e credenciais no formato `in_<public-id>.<secret>`.

A coluna `alert_types.api_key` permanece somente para credenciais de saída do conector ALRT → AXE; ela não é mais aceita como credencial inbound.

## MySQL real

Foi instalado e usado MySQL:

```text
MySQL 8.0.46-0ubuntu0.24.04.4
```

O teste real cobriu:

- dois workers concorrentes;
- `FOR UPDATE SKIP LOCKED`;
- reivindicação única da entrega;
- lease expirado;
- recuperação por outro worker.

Um defeito real no tratamento do retorno do driver foi corrigido: o resultado `rows + metadata` do mysql2 estava sendo interpretado incorretamente como várias entregas.

## Build

Foram removidos:

- placeholders de analytics não configurados;
- script externo inválido no `index.html`;
- warning de chunks grandes via code splitting por React, query, Radix, ícones, charts, motion e vendor;
- warning de configuração pnpm obsoleta, movendo a configuração para `pnpm-workspace.yaml`.
