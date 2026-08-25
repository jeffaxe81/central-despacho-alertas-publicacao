# Workflow de recebimento de ocorrências

O sistema de integração passou a expor um receptor HTTP para ocorrências externas:

```text
POST https://despachoalrt-hjwc4f8q.manus.space/api/integrations/occurrences
```

Esse é o endpoint de integração que pode ser configurado em um workflow do Dispatch App. O domínio `dispatchapp-dmbshjft.manus.space` permanece como aplicação remetente/operacional; para que ele envie ocorrências, seu workflow deve realizar um `POST` para a URL acima.

O workflow espera `Content-Type: application/json` e a credencial no header `x-api-key`. A chave deve ser criada ou informada em uma categoria da tela **Integrações**; a mesma chave autentica o remetente e vincula a ocorrência à categoria e ao usuário corretos.

| Situação | Retorno | Significado |
| --- | --- | --- |
| API key ausente ou inválida | `401` | O workflow não processa o payload. |
| Payload fora do contrato | `422` | A estrutura ou coordenadas precisam ser corrigidas. |
| Nova ocorrência aceita | `202` | A ocorrência foi registrada para processamento. |
| Mesmo `id` recebido novamente | `200` | Retorno idempotente, sem duplicar o registro. |

O workflow valida `id`, `code`, prioridade, status, timestamp, tipo, título, narrativa, endereço e coordenadas. A tabela `received_workflow_occurrences` conserva o payload original e cria uma chave única por `alert_type_id` e `external_id` para impedir duplicidades.

O contrato aceito corresponde ao perfil **AXE Dispatch** da central: `schemaVersion: "1.0"`, `id`, `code`, `priority`, `status`, `createdAt`, `eventType`, `title`, `narrative` e `location`. O teste de integração da rota confirma as respostas `401` para ausência de API key, `422` para coordenadas inválidas, `202` para aceite e `200` para repetição idempotente.

Além do registro da ocorrência, a tabela `workflow_process_logs` mantém o desfecho de cada tentativa: `accepted`, `duplicate`, `invalid` ou `unauthorized`, com código HTTP, motivo e payload quando disponível. Isso permite auditar os retornos do workflow mesmo quando uma solicitação é rejeitada antes da criação da ocorrência.

> Para testar, configure uma API key na categoria receptora e envie o payload de exemplo em `integration-examples/payload-ocorrencia.json` ao endpoint acima usando o header `x-api-key`.

## Validação visual do painel

Em **22 de agosto de 2026**, a rota `/workflow` foi conferida em viewport de desktop de 1280 × 720 pixels. A inspeção confirmou que o cartão **Conectar o workflow do Dispatch App** exibe a URL publicada do receptor, o botão de cópia, os headers `Content-Type` e `x-api-key`, o aviso de não recuperação da chave após salvamento e as quatro etapas de configuração. O guia permaneceu legível acima das tabelas de resultados recentes e ocorrências aceitas, sem sobreposição dos elementos de navegação.
