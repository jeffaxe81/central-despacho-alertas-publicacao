# Como preencher a integração ALRT → AXE

Abra **Integrações**, escolha uma categoria de teste e clique em **Configurar**. Depois use o botão **Aplicar ALRT → AXE**. Ele preenche o modelo de payload, a URL oficial de homologação e o nome correto do header da API key. Confira os campos abaixo antes de salvar.

| Campo da tela | Preenchimento para homologação AXE | Observação |
| --- | --- | --- |
| **Endpoint REST de destino** | `https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events` | Use a URL completa. Não use `/central-despacho`, `/eventos` ou endereço relativo. |
| **Usar MOCK** | **Não**, para enviar ao AXE de homologação. | Com MOCK ligado, a Central entrega apenas ao receptor interno e não chama o AXE. Deixe ligado somente para testar a interface sem tráfego externo. |
| **Headers personalizados (JSON)** | `{}` | Não informe API key, timestamp ou assinatura aqui. A Central cria automaticamente `Content-Type`, `X-Timestamp`, `X-Request-Timestamp`, `X-Correlation-Id` e `X-Signature`. |
| **Token Bearer** | Deixe vazio. | O AXE não usa Bearer token neste fluxo. |
| **Nome do header da API key** | `X-ALRT-API-Key` | Mantenha esta grafia. O botão **Aplicar ALRT → AXE** já a seleciona. |
| **API key** | Cole a **API key de homologação fornecida/configurada no AXE**. | Não gere uma chave nova na Central, exceto se a mesma chave também for cadastrada no cofre do AXE. Após salvar, o valor não fica visível novamente. |
| **Modelo de payload JSON** | Use o modelo inserido por **Aplicar ALRT → AXE**. | Não substitua pelo perfil anterior `AXE Dispatch`; ele tem estrutura diferente e não é aceito pelo receptor ALRT do AXE. |

> O segredo HMAC **não é digitado nesses campos**. Ele é guardado com segurança no servidor da Central como `AXE_HMAC_SECRET`. Quando o modelo ALRT → AXE está selecionado e o MOCK está desligado, a Central assina automaticamente o **mesmo JSON bruto** que envia no `POST`.

## O verbo POST está faltando?

Não. O método já é fixo no despachante da Central: todo envio REST para esta integração é feito por **`POST` com `Content-Type: application/json`**. Por isso não existe um seletor de verbo na tela.

## Checklist antes de enviar um teste real

| Verificação | Esperado |
| --- | --- |
| Perfil | **ALRT → AXE** aplicado. |
| URL | Termina em `/api/integrations/alrt/events`. |
| MOCK | Desligado. |
| Bearer | Vazio. |
| API key | Presente no campo e igual à chave do AXE. |
| HMAC | `AXE_HMAC_SECRET` configurado no servidor da Central e igual ao segredo do AXE. |
| Resultado esperado | `202 RECEIVED` para novo evento; `200` para duplicidade da mesma chave de idempotência. |

Após salvar, gere manualmente **um** alerta de teste. Nesta homologação, o AXE somente persiste e audita o evento; ele não abre ocorrência, não atribui equipe e não dispara operação automática.
