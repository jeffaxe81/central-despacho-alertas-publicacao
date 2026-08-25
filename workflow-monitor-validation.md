# Validação da visão operacional do workflow

Em 22 de agosto de 2026, a rota `/workflow` foi verificada em 1280 × 720. A primeira captura retornou 404 porque a rota não estava registrada no roteador principal. Após o registro explícito de `/workflow`, a página foi renderizada dentro da Central de Alertas com:

| Área | Resultado observado |
| --- | --- |
| Navegação | A aba **Workflow** aparece ativa e é acessível diretamente. |
| Resumo | Contadores de aceites, duplicidades e rejeições são exibidos. |
| Auditoria | A tabela mostra os resultados recentes do processamento. |
| Ocorrências | A tabela separada apresenta somente recebimentos únicos aceitos. |
| Estado vazio | Mensagens claras são apresentadas enquanto não há chamadas externas. |

> A interface preserva a identidade visual de baixa luminosidade da central e permite atualizar os dados sob demanda.

A suíte automatizada também valida a consulta composta de ocorrências e logs, o limite solicitado, a ordenação encadeada e o estado vazio retornado ao operador autenticado.
