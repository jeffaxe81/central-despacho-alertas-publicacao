# Confirmação do receptor AXE — homologação

**Data do registro:** 22 de agosto de 2026  
**Origem da confirmação:** responsável pela integração AXE, em mensagem na sessão.

> O receptor de homologação foi informado como publicado e pronto para receber payloads assinados. A confirmação operacional recebida relata retorno `202 RECEIVED` e esclarece que os eventos são apenas persistidos e auditados nesta etapa.

| Item confirmado | Valor ou comportamento |
| --- | --- |
| Endpoint | `https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events` |
| Método e corpo | `POST` com JSON |
| Autenticação | `X-ALRT-API-Key` |
| Integridade | `X-Timestamp` e `X-Signature` com HMAC-SHA256 do corpo bruto |
| Correlação | `X-Correlation-Id` é preferencial e a Central o envia com o mesmo valor de `payload.correlationId` |
| Retorno validado pelo AXE | `202 RECEIVED` para payload válido |
| Efeito operacional | Persistência e auditoria somente; não cria ocorrência, atribuição ou despacho automático |

## Situação da Central de Alertas

O perfil **ALRT → AXE** da Central aponta para o endpoint acima e produz o envelope `1.0` de `alert.received`. Ele transmite JSON por `POST`, fornece `X-ALRT-API-Key`, emite timestamp UTC, calcula `X-Signature` em HMAC-SHA256 sobre `timestamp.corpo_bruto` e preserva a mesma correlação no header e no envelope. O envio é bloqueado antes de qualquer chamada externa se a API key obrigatória não estiver configurada.

## Limitação de homologação e próximo teste

A Central não enviou uma nova ocorrência à instância AXE publicada nesta validação, porque o ato cria um registro de auditoria externo. Para o teste ponta a ponta, o responsável deve configurar a API key de homologação na categoria, manter o segredo HMAC no cofre e autorizar explicitamente um alerta de teste. O resultado esperado é `202 RECEIVED`; uma repetição com a mesma `idempotencyKey` deve resultar em `200` sem duplicação.

## Entrega ponta a ponta autorizada

Em **22 de agosto de 2026**, após validação da API key no endpoint de saúde, a Central enviou um único alerta sintético assinado ao endpoint publicado. O AXE respondeu **`202 RECEIVED`**, confirmou a integridade e devolveu o mesmo identificador de correlação enviado: `6e85c7fa-ea18-458b-9bc3-2878ec7cf09e`. O recibo retornado foi `rcpt_72730daeb6ccdadef7ee3186` e o evento aceito foi `evt_alrt_354d5fa8-23a7-45b2-8762-57330cd75f6b`.

> Esta entrega criou somente o registro de auditoria previsto para homologação. Nenhuma ocorrência operacional, atribuição ou despacho automático foi criado.

## Configuração persistida da Central

Após autorização do responsável, as categorias **Iluminação pública** e **Segurança pública municipal** foram alinhadas ao perfil ALRT → AXE. A verificação de persistência confirmou o endpoint publicado, `X-ALRT-API-Key`, API keys presentes sem exposição, Bearer removido, MOCK desativado e o modelo `alert.received` com `sourceStatus: "novo"`. Nenhum alerta foi enviado durante essa atualização de configuração.
