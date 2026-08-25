# Validação do seletor de localização

O fluxo de localização foi validado em **1280 × 720** e **375 × 812**. No simulador, o mapa estático autenticado mostrou o marcador sobre a coordenada selecionada, o botão de sugestão permaneceu acessível e os campos de latitude/longitude ficaram visíveis nos dois formatos.

| Cenário | Resultado |
| --- | --- |
| Mapa interativo disponível | Clique e arraste atualizam a coordenada do próximo alerta. |
| Mapa interativo indisponível | O mapa estático continua visível e clicável; os campos numéricos permitem ajuste fino. |
| Disparo manual | Latitude, longitude e a referência combinada seguem ao payload REST e são gravadas no histórico. |

> A prévia validada utilizou o fallback de mapa estático autenticado, mantendo o fluxo funcional para o operador.
