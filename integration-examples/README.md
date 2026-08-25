# Integração REST de alertas urbanos

Este material propõe um contrato para integração futura com um sistema de despacho. O AXE Dispatch ainda não publicou uma API externa de recebimento; portanto, o conteúdo abaixo é um **contrato recomendado para ambiente de testes**, e não uma confirmação de uma rota em produção.

## Contrato recomendado

O receptor deve expor `POST /api/integrations/occurrences`, responder `202 Accepted` quando a ocorrência for enfileirada e exigir autenticação Bearer em produção. O arquivo `payload-ocorrencia.json` contém uma ocorrência completa de exemplo.

## Autenticação por API key

Além do token Bearer, cada tipo de evento pode armazenar uma **API key**. Na configuração da integração, informe o segredo e o nome exato do header exigido pelo receptor, como `x-api-key` ou `x-integration-key`. O segredo é mantido somente no servidor: depois de salvo, a interface informa apenas que existe uma chave configurada, sem devolvê-la ao navegador.

O botão **Gerar** cria uma chave com 32 bytes aleatórios no navegador, no formato `ak_<hexadecimal>`. Use **Copiar** antes de salvar se precisar registrar a credencial no sistema receptor; depois do salvamento, a chave fica novamente oculta na interface.

O despachante acrescenta a API key a cada `POST` externo. O nome do header é validado para impedir caracteres inválidos, enquanto cabeçalhos personalizados continuam disponíveis para necessidades adicionais do receptor.

Na tela **Integrações** da central, a ação **Aplicar perfil AXE** preenche o modelo com a estrutura compatível: `id`, `code`, `priority`, `status`, `createdAt`, `eventType`, narrativa e `location`. As severidades internas são normalizadas para `LOW`, `MEDIUM`, `HIGH` ou `CRITICAL`. Essa ação não modifica endpoint, token ou modo teste.

O painel **Prontidão para AXE Dispatch** mostra quantas categorias já usam o perfil e quantas ainda estão protegidas pelo mock. Ao salvar um payload com `schemaVersion: "1.0"`, o servidor valida os campos essenciais e as coordenadas antes de persistir a configuração.

As coordenadas interpoladas pelo modelo são aceitas tanto como texto quanto como número no momento da validação e são normalizadas como números no payload final de despacho. O salvamento do perfil foi coberto por teste automatizado.

| Campo | Tipo | Obrigatório | Finalidade |
| --- | --- | --- | --- |
| `id` | string | Sim | Identificador idempotente da ocorrência. |
| `code` | string | Sim | Código operacional apresentado ao despachante. |
| `priority` | string | Sim | `LOW`, `MEDIUM`, `HIGH` ou `CRITICAL`. |
| `status` | string | Sim | Estado inicial, recomendado como `NEW`. |
| `createdAt` | ISO 8601 | Sim | Momento UTC de criação. |
| `eventType` | string | Sim | Categoria normalizada do alerta. |
| `narrative` | string | Sim | Contexto descritivo da ocorrência. |
| `location.latitude` | number | Sim | Latitude WGS84. |
| `location.longitude` | number | Sim | Longitude WGS84. |
| `source` | object | Sim | Origem, modo e correlação da simulação. |

| Autenticação | Configuração recomendada |
| --- | --- |
| Bearer token | Informe o token no campo **Token Bearer**; o envio usa `Authorization: Bearer …`. |
| API key padrão | Informe a chave e mantenha `x-api-key` como header. |
| API key customizada | Informe a chave e substitua o header pelo nome contratado, como `x-integration-key`. |

> Para retries seguros, o receptor deve tratar `id` como chave de idempotência: o reenvio do mesmo alerta não pode criar uma segunda ocorrência.

## Interface de mapa

`interface-mapa.html` e `interface-mapa.js` demonstram a interface simples. O JavaScript permite clicar no mapa, arrastar o marcador e editar latitude/longitude. Em aplicações Manus, o carregamento do Google Maps deve ocorrer pelo componente `MapView` e seu proxy integrado; o HTML não deve conter chave de API.

Para experimentar a versão já executável dentro deste projeto, abra `/exemplos-integracao`. Ela usa o componente `CoordinatePicker`/`MapView`, exibe o mapa com fallback autenticado e atualiza o payload JSON em tempo real conforme a coordenada é alterada.

## Simulação local

Em dois terminais, dentro desta pasta, execute primeiro `node mock-receiver.mjs`. Depois, execute `node simulate-alerts.mjs` para inspecionar um *dry run*, sem enviar qualquer dado. Para enviar três ocorrências ao receptor local, use `node simulate-alerts.mjs --send`. Para alterar o volume, use por exemplo `node simulate-alerts.mjs --send --count=12`.

O script bloqueia destinos externos por padrão. Em um ambiente de testes aprovado, defina `ALERT_TARGET_URL` e, de forma explícita, `ALLOW_NON_LOCAL_TEST_TARGET=true` antes de usar `--send`.

## Validação executada

Em 22 de agosto de 2026, os scripts foram validados sintaticamente. Um *dry run* produziu o payload sem transmitir dados e, em seguida, dois alertas fictícios foram enviados ao `mock-receiver.mjs` local com resposta HTTP `202` e confirmação de aceite.
