# Validação de HMAC e promoção segura — ALRT → AXE

Este diretório contém exemplos de envio para o endpoint de homologação do AXE. Os exemplos **não incluem segredos**; eles leem `AXE_API_KEY` e `AXE_HMAC_SECRET` exclusivamente das variáveis de ambiente.

> **Regra crítica:** assine exatamente os bytes do JSON transmitido. O valor assinado é `X-Timestamp + "." + corpo_JSON_bruto_em_UTF8`. Não reordene campos, reformate ou serialize novamente o corpo depois de calcular a assinatura.

## Pré-requisitos no AXE

O receptor precisa estar implantado, com o modo de homologação autorizado, HTTPS ativo, relógio sincronizado e validação HMAC executada **antes** do parse JSON. O segredo no AXE pode se chamar `ALRT_INGRESS_HMAC_SECRET`; no ALRT, o mesmo valor é guardado como `AXE_HMAC_SECRET`. Os nomes podem ser diferentes, mas o valor precisa ser idêntico e nunca deve aparecer em logs, payloads ou arquivos versionados.

| Configuração | Valor de homologação |
| --- | --- |
| Endpoint | `https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events` |
| Método | `POST` |
| API key | Header `X-ALRT-API-Key` |
| Tempo | `X-Timestamp` e `X-Request-Timestamp` com o mesmo ISO 8601 em UTC |
| Correlação | `X-Correlation-Id` igual a `payload.correlationId` |
| Assinatura | `X-Signature: sha256=<hex>` com HMAC-SHA256 |
| Timeout | 15 segundos |

## Como validar a recepção e a assinatura

Primeiro, no cofre do ambiente de homologação, configure a API key e o segredo HMAC no AXE e no ALRT. Depois, execute um dos exemplos com variáveis temporárias no seu terminal. **Não cole valores reais em chat nem os adicione ao repositório.**

```bash
export AXE_API_KEY='valor-fornecido-pelo-cofre'
export AXE_HMAC_SECRET='segredo-compartilhado-do-cofre'
node integration-examples/axe-hmac/send-signed-alert.mjs
```

```bash
export AXE_API_KEY='valor-fornecido-pelo-cofre'
export AXE_HMAC_SECRET='segredo-compartilhado-do-cofre'
python3 integration-examples/axe-hmac/send_signed_alert.py
```

O teste é válido quando a resposta for `202` para um novo alerta ou `200` para a repetição da mesma `idempotencyKey`. Registre o `correlationId` retornado pelo script e confirme no log do AXE que o mesmo valor foi aceito. Para validar a defesa, altere **um único byte** do corpo depois do cálculo da assinatura em um ambiente de teste isolado: o receptor deve retornar `401` com `INVALID_SIGNATURE`. Em seguida, repita com timestamp vencido e API key inválida; ambos também devem resultar em `401`, mas com motivo de auditoria distinto.

| Resposta | Diagnóstico operacional |
| ---: | --- |
| `202` | O receptor aceitou o alerta para a fila de homologação. |
| `200` | A mesma chave de idempotência foi reconhecida como duplicada. Não gere novo evento. |
| `400` | Corrija envelope, campo obrigatório ou correlação antes de nova tentativa. |
| `401 INVALID_SIGNATURE` | Confirme segredo, timestamp e a igualdade entre corpo assinado e corpo enviado. |
| `401` por API key/timestamp | Confirme credencial, relógio UTC e janela de aceitação do receptor. |
| `429` | Respeite `Retry-After` e repita o mesmo corpo e chave de idempotência. |
| `503` | A homologação pode estar desabilitada; confirme o modo autorizado antes de repetir. |

## Próximos passos para produção

A promoção deve ocorrer somente após evidência de uma entrega `202`, uma duplicidade `200`, uma rejeição HMAC `401` controlada e uma repetição `429` ou `503` testada sem criar ocorrência duplicada. Em seguida, promova o código do receptor AXE que efetivamente compara `X-Signature` em tempo constante antes do parse do JSON, mantendo a API key e o timestamp como camadas independentes.

| Etapa | Critério de aprovação |
| --- | --- |
| Segredos | Gerar API key e HMAC **exclusivos de produção**, armazenados em cofre e com procedimento de rotação. |
| Receptor AXE | Exigir HTTPS, validar assinatura, timestamp, API key, schema e idempotência; nunca registrar segredos ou corpo sensível completo. |
| ALRT | Atualizar o destino para a URL de produção, usar `source.environment: "producao"` somente após autorização e manter o corpo assinado imutável. |
| Observabilidade | Monitorar 2xx, 4xx, 429, 503, tempo de resposta e correlação ponta a ponta; alertar para falhas de assinatura. |
| Liberação | Realizar canário com uma categoria e baixa taxa; ampliar somente após a auditoria confirmar ausência de duplicidades e erros de validação. |
| Contingência | Manter chave anterior durante a janela de rotação, ter rollback de endpoint e pausar automações se ocorrerem 401/5xx sustentados. |

O código da Central já produz o perfil ALRT → AXE, assina o corpo bruto no servidor e repete erros transitórios com 5, 15 e 45 segundos. A pendência externa é garantir que a implantação do AXE valide HMAC conforme o mesmo algoritmo e o mesmo corpo bruto.
