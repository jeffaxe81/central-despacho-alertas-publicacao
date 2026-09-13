# ADR-0005 — Geração canônica antes da fronteira do mock

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-12
- Decisão: gerar o evento canônico no dispatcher antes do mock para ALRT → AXE em modo teste, mantendo o payload legado em paralelo

## Contexto

A MUE-003 validou a equivalência entre o contrato canônico e o payload legado reconstruindo o evento canônico dentro do mock. Essa abordagem reduziu risco, mas ainda deixava o runtime dependente do legado para produzir a representação canônica.

## Decisão

Quando `dispatchConfiguredAlert()` identifica o conector ALRT → AXE em modo teste, ele passa a:

1. gerar a ocorrência sintética;
2. montar o payload legado exatamente como antes;
3. construir um evento canônico a partir da ocorrência antes da fronteira do mock;
4. enviar ao mock o payload legado e o evento canônico em paralelo;
5. permitir que o mock projete o canônico por `toAlrtAxeEvent` e compare as duas representações.

Para todos os demais cenários, inclusive qualquer entrega real, o comportamento existente permanece inalterado.

## Contrato do evento canônico

O evento usa CloudEvents 1.0 e mantém:

- `type`: `com.axesistemas.alerta.urbano.recebido.v1`;
- `source`: `urn:axesistemas:motor-eventos:alertas`;
- `dataschema`: `urn:axesistemas:schema:alerta:urbano:1.0.0`;
- `axessimulated: true`;
- identificadores, correlação, idempotência, semente e localização derivados da mesma ocorrência sintética usada no payload legado.

## Limites de segurança

- somente ALRT → AXE em modo teste gera canônico antes do mock;
- envio HTTP real continua legado;
- autenticação, HMAC, retry e validação de endpoint não foram alterados;
- barramento, outbox, webhook e SSE continuam recebendo o payload existente;
- banco e migrations não foram alterados;
- o fallback de reconstrução canônica dentro do mock permanece temporariamente para compatibilidade.

## Validação

A microentrega usa TDD. O primeiro teste falhou porque `canonicalEvent` chegava como `undefined`. Após a implementação, a suíte passou a provar que:

- o dispatcher envia `canonicalEvent` explicitamente;
- `toAlrtAxeEvent(canonicalEvent)` é idêntico ao payload legado entregue ao mock;
- o restante da suíte permanece verde;
- tipagem e build de produção continuam aprovados.

## Próxima microentrega recomendada

MUE-005: remover gradualmente a reconstrução canônica a partir do legado dentro do mock e tornar o canônico explícito a única fonte da comparação shadow para ALRT → AXE em modo teste. A entrega real deve continuar legado até novo gate de compatibilidade.
