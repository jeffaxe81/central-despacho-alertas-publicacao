# Validação da interface — Configurações Gerais

**Data da validação:** 22 de agosto de 2026  
**Rota inspecionada:** `/configuracoes`  
**Viewport:** desktop, 1280 × 720 pixels.

| Elemento conferido | Resultado |
| --- | --- |
| Seção principal | O cartão **Configurações gerais de localização** é exibido no topo da aba Integrações. |
| Valores padrão | Latitude e longitude são mostradas com seis casas decimais em cartões de leitura rápida. |
| Seletor visual | O mapa exibe marcador e controle de sugestão, permitindo clique, arraste ou edição numérica pelo fallback. |
| Salvamento | O botão **Salvar localização padrão** persiste o valor selecionado. O teste de interface alterou ambas as coordenadas e confirmou a chamada de salvamento com o mesmo par de valores. |
| Aplicação | Após a leitura da configuração persistida, o simulador passa a iniciar na coordenada geral; seleções temporárias no simulador continuam prevalecendo para o próximo alerta. |

> A seção foi validada visualmente e com teste de interação, sem alterar o histórico de alertas existentes.
