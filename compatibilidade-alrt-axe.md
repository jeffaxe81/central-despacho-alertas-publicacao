# Compatibilidade de integração — Central de Alertas (ALRT) → AXE Dispatch

**Data da análise:** 22 de agosto de 2026  
**Escopo:** homologação unidirecional, com a Central de Alertas como remetente e o AXE Dispatch como receptor.  
**Fontes analisadas:** `CONTRATO_ENTRADA_ALRT_AXE.md`, `CONTRATO_PAYLOADS_ALRT_PROPOSTA.md`, `CONFIGURACAO_RECEPTOR_ALRT_HOMOLOGACAO.md` e `server/alrtIngress.ts`, todos incluídos no arquivo fornecido pelo usuário.

> O contrato do AXE aceita exclusivamente `alert.received` em homologação. Um evento válido é recebido em triagem, sem despacho automático, e deve conter envelope versionado, identificação de correlação, idempotência e o objeto `data.alert`.

## Ajuste implementado na Central de Alertas

Foi adicionado o perfil **ALRT → AXE** no formulário de integração. Ao aplicá-lo, a Central gera o envelope `schemaVersion: "1.0"`, `eventId`, `eventType: "alert.received"`, `occurredAt`, `source`, `correlationId`, `idempotencyKey` e `data.alert`. As prioridades são emitidas no formato exigido pelo AXE (`baixa`, `media`, `alta` ou `critica`), enquanto endereço, latitude, longitude, descrição e data de relato são encaminhados no objeto correto.

O despachante também acrescenta, quando o envelope fornece os valores correspondentes, os headers `X-Event-Id`, `X-Event-Type`, `Idempotency-Key`, `X-Correlation-Id`, `X-Timestamp` e `X-Request-Timestamp`. O mesmo `correlationId` é emitido no envelope e no header de correlação. A configuração do perfil seleciona `X-ALRT-API-Key`, preenche a URL de homologação e assina o corpo UTF-8 efetivamente enviado com `X-Signature: sha256=<hex>`, calculado sobre `X-Timestamp + "." + corpo bruto`. Valores interpolados em JSON são escapados, evitando que aspas e quebras de linha de narrativas tornem o corpo inválido. O retry usa três tentativas com backoff de 5, 15 e 45 segundos; em `429`, respeita `Retry-After` quando fornecido.

| Elemento | Requisito identificado no AXE | Situação na Central após o ajuste |
| --- | --- | --- |
| Evento | Apenas `alert.received` | **Compatível** pelo perfil ALRT → AXE. |
| Envelope | `schemaVersion`, `eventId`, `occurredAt`, `source`, `correlationId` e `idempotencyKey` | **Compatível**; campos emitidos pelo novo modelo. |
| Dados do alerta | `data.alert` com identificador externo, categoria, prioridade, descrição, endereço, coordenadas e data | **Compatível**; latitude e longitude são números, não texto. |
| Idempotência | Repetições com a mesma chave não devem criar novo efeito | **Compatível**; a mesma carga é reutilizada nas tentativas e o header de idempotência é incluído. |
| Autenticação | `X-ALRT-API-Key`, HMAC-SHA256 e timestamp recente; chave com ao menos 32 caracteres | **Compatível por configuração**; o segredo HMAC é protegido no servidor e a API key continua protegida na categoria. |
| Correlação | `correlationId` deve ser igual ao `X-Correlation-Id` | **Compatível**; um identificador determinístico é usado em ambos. |
| Limite de taxa e indisponibilidade | `429` deve respeitar `Retry-After`; `503` deve ser repetido | **Compatível**; a política usa três tentativas com backoff 5/15/45 segundos e trata ambos os códigos como transitórios. |
| Dados proibidos | Sem anexos, Base64, contatos ou segredos no corpo | **Compatível**; o perfil só contém dados operacionais simulados e não inclui esses campos. |

## Incompatibilidades identificadas

| Item | Impacto | Tratamento aplicado ou necessário |
| --- | --- | --- |
| Perfil anterior `AXE Dispatch` | Usava `id`, `code`, prioridade em maiúsculas, `createdAt`, `narrative`, `location` e `source.mode`. Esse formato **não é aceito** pelo receptor ALRT do AXE, que usa envelope estrito com `eventId`, `data.alert` e `source.environment`. | Use o novo perfil **ALRT → AXE** para o endpoint do AXE. O perfil anterior permanece destinado ao receptor HTTP já existente nesta Central. |
| Campos extras de coordenadas no nível superior | O schema do AXE é estrito e rejeita propriedades desconhecidas. | Corrigido: o novo envelope não recebe `latitude`, `longitude` ou `coordinates` no nível superior. |
| Validação HMAC no receptor AXE | O novo roteiro exige `X-Signature`, mas o `server/alrtIngress.ts` fornecido valida apenas API key e `X-Request-Timestamp`. | A Central já envia a assinatura HMAC conforme o roteiro. **Pendente no AXE**: validar `X-Signature` usando o mesmo segredo e rejeitar assinatura inválida com `401`. |
| Nome do header de tempo | O roteiro novo usa `X-Timestamp`; o código AXE fornecido exige `X-Request-Timestamp`. | Corrigido na Central: os dois headers recebem exatamente o mesmo timestamp, preservando compatibilidade durante a homologação. |
| Corpo de resposta | O roteiro novo descreve `status: RECEIVED`/`DUPLICATE`; o código AXE fornecido retorna `accepted`/`duplicate` em minúsculas. | **Pendente no AXE**: padronizar a resposta ou declarar ambos os formatos como aceitos pelo remetente. A Central considera o status HTTP 200/202 como confirmação de entrega. |
| Endpoint e ativação | O endpoint confirmado é `https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events`; o receptor retorna `503` enquanto `ALRT_INGRESS_MODE=homologacao` e uma chave válida não forem configurados. | O perfil agora preenche essa URL. **Pendente no AXE**: implantar/ativar o receptor e configurar as variáveis seguras de homologação. Não foi feito nenhum envio externo. |
| Health check | O AXE expõe `GET /api/integrations/alrt/health` com a mesma API key. | **Disponível no código fornecido**, mas só poderá ser validado após a implantação e configuração da chave no AXE. |
| Corpo máximo | O AXE limita a carga a 256 KB. | **Compatível para alertas simulados atuais**; anexos e Base64 não são enviados. |

## Configuração segura para homologação

| Campo na Central | Valor para o piloto AXE |
| --- | --- |
| Endpoint REST | `https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events` |
| Modo teste | Mantido ativo até o responsável pelo AXE confirmar o receptor de homologação. |
| Perfil de payload | **ALRT → AXE** |
| Header da chave | `X-ALRT-API-Key` |
| API key | Chave de homologação com pelo menos 32 caracteres, compartilhada somente por canal seguro e nunca colocada no payload. |
| Assinatura | `X-Signature` em HMAC-SHA256 sobre `X-Timestamp.corpo UTF-8`, com o segredo protegido `AXE_HMAC_SECRET`. |
| Tentativas | Até três tentativas, com 5, 15 e 45 segundos; `Retry-After` prevalece para `429`. |
| Payload permitido | Somente `alert.received`, dados operacionais mínimos e `source.environment: "homologacao"`. |

O perfil foi validado com **41 testes automatizados**, incluindo o salvamento do modelo ALRT → AXE, a assinatura HMAC contra um receptor HTTP local, a igualdade de correlação entre envelope e header e o bloqueio preventivo quando a API key não está configurada. O receptor de homologação publicado foi confirmado pelo responsável como disponível em `https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events`, com retorno `202 RECEIVED` para payload assinado. A Central está compatível com os requisitos informados: `POST` JSON, `X-ALRT-API-Key`, `X-Timestamp`, `X-Signature` e `X-Correlation-Id`.

> A Central não efetuou ainda uma nova chamada contra o endpoint publicado a partir desta configuração, porque isso persistiria um alerta de auditoria no AXE. O teste ponta a ponta requer API key de homologação configurada na categoria e autorização explícita para criar esse registro de teste.
