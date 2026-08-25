# Validação — localização geral avançada

**Data da validação:** 22 de agosto de 2026  
**Rota visual inspecionada:** `/configuracoes`  
**Viewport:** desktop, 1280 × 720 pixels.

| Fluxo | Regra validada | Evidência |
| --- | --- | --- |
| Herança por categoria | Uma categoria com `useGeneralLocation` ativo usa a posição geral; uma seleção temporária no simulador continua tendo prioridade. | Teste do despachante cobre a coordenada geral recebida e preserva o override temporário. |
| Coordenada própria | O formulário permite desligar **Usar localização geral** para manter mapa e latitude/longitude exclusivos da categoria. | Controle acessível no diálogo, com rótulo próprio. |
| Busca de endereço | O endereço é enviado ao geocodificador autenticado e o primeiro resultado preenche a localização geral. | Teste tRPC valida a conversão de endereço em latitude/longitude; teste de interface valida o preenchimento no painel. |
| Localização atual | O botão solicita a posição apenas após clique do operador e preenche o rascunho, sem salvar automaticamente. | Teste de interface simula concessão da posição pelo navegador. |
| Interface | A captura exibiu os valores padrão, o campo **Buscar endereço**, os botões **Buscar** e **Usar minha localização**. | Inspeção visual registrada durante a validação. |

> A confirmação da permissão de localização permanece sob controle do usuário no navegador. A posição só é persistida após o clique em **Salvar localização padrão**.
