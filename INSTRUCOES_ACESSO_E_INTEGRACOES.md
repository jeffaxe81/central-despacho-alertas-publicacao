# Central de Alertas Urbanos — Acesso e Integrações

## Acesso à aplicação

A versão publicada está disponível em [https://central-aler-hzdtze6w.manus.space](https://central-aler-hzdtze6w.manus.space). Abra o endereço em uma janela normal do navegador e selecione **Entrar**. Conclua a autenticação pelo provedor escolhido; após o retorno, o painel exibirá a visão geral, o simulador, o histórico, o workflow e as integrações.

> Se houver uma tentativa de login anterior aberta, reinicie o fluxo pelo botão **Entrar** na página inicial. A versão atualizada já valida o estado de OAuth corretamente no retorno do provedor.

## Operação segura

O aplicativo inicia em **modo teste**. Nesse modo, o disparo cria uma ocorrência simulada e a entrega é processada pelo receptor interno, com resposta `202` e registro auditável no histórico. Esse é o modo recomendado para validar categorias, narrativas, coordenadas e payloads antes de conectar uma central externa.

| Área | Uso recomendado |
| --- | --- |
| **Simular alertas** | Escolha a categoria, ajuste a localização se necessário e dispare uma ocorrência fictícia. |
| **Histórico** | Confira status, tentativas, retorno HTTP, payload e narrativa de cada entrega. |
| **Integrações** | Configure individualmente o destino, a autenticação e o contrato de payload por categoria. |
| **Workflow** | Acompanhe ocorrências recebidas por integrações externas e os respectivos registros de processamento. |

## Configuração de uma integração externa por categoria

Na área **Integrações**, abra a categoria desejada e mantenha o modo teste ativo enquanto faz a validação inicial. Quando o endpoint externo estiver pronto, desative o modo teste e informe um endereço público HTTP ou HTTPS. Defina os cabeçalhos no formato de objeto JSON, como `{ "x-origem": "central-alertas" }`; se necessário, preencha um token Bearer ou uma API key com o respectivo nome de cabeçalho.

O modelo de payload deve ser um objeto JSON. Ele pode usar as variáveis `{{alertId}}`, `{{category}}`, `{{eventName}}`, `{{severity}}`, `{{timestamp}}`, `{{address}}`, `{{neighborhood}}` e `{{narrative}}`. As propriedades `latitude`, `longitude` e `coordinates` são acrescentadas pelo aplicativo ao envio. Entregas com falha de rede, HTTP `429` ou erros `5xx` recebem até três tentativas; respostas `4xx` são registradas como falhas de negócio e não são repetidas.

> Para integrações que exijam assinatura HMAC, configure o segredo de produção `AXE_HMAC_SECRET` no ambiente do projeto antes de ativar o despacho real. O valor deve ser tratado como segredo e não deve ser inserido no modelo de payload, em cabeçalhos visíveis ou no código do cliente.

## Automação

Cada categoria pode ser ativada para execução periódica pelos intervalos disponíveis na interface. A automação é executada pelo servidor publicado e não depende de um navegador aberto. Antes de habilitar uma categoria em ambiente real, valide manualmente o endpoint, o payload e a autenticação no modo teste.
