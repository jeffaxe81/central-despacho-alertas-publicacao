# ADR-0018 — Classificação de criticidade diagnóstica (MUE-017)

## Contexto
O histórico MUE-016 permite examinar tendências e avisos, mas não comunica criticidade. O objetivo é produzir uma avaliação **somente leitura** para orientar uma futura central operacional de alertas, sem gerar notificações ou alterar fluxos de despacho.

## Decisão
- Implementar `evaluateCanonicalShadowAlertSeverity()` sobre a janela em memória da MUE-016.
- Estados: `idle` (sem evidência), `healthy`, `warning` e `critical`.
- Quando o diagnóstico atual for `warning`, retornar `warning`; elevar para `critical` apenas após `criticalAfterConsecutiveWarnings` avaliações consecutivas em `warning`.
- Quando a política estiver `healthy` mas a tendência da última amostra for `degrading`, sinalizar `warning` antecipado.
- Informar razões tipadas (`policy_violation`, `degrading_trend`, `consecutive_warnings`), violações atuais, sequência e indicador de recuperação de `warning` para `healthy`.
- O limiar de recorrência **é obrigatório e configurado pelo chamador**, entre 1 e 20; não adotar regra de negócio implícita.

## Não objetivos
Esta entrega não envia e-mails, SMS, push ou webhooks, não cria eventos reais, não automatiza resposta, não armazena dados no banco, não persiste histórico nem fornece UI/API/tRPC. O classificador não registra nova amostra. Recorrência significa **avaliações consecutivas**, não falhas de despacho distintas.

## Segurança
O cálculo passa pela fronteira interna `isTestMode` da MUE-016; produção não consegue consultar esse diagnóstico. Não há mudança em autenticação, roteamento, Outbox, SSE, ALRT→AXE ou isolamento multi-tenant real.

## Verificação
Casos automatizados: vazio, saudável, escalonamento configurável, degradação precoce, recuperação, janela FIFO, rejeição fora do modo teste e pureza dos dados.
