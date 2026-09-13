# ADR-0007 — Observabilidade canônica shadow isolada

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-12
- Decisão: observar o evento canônico explícito no caminho de teste por log estruturado, sem alterar o fan-out legado do barramento

## Contexto

A MUE-005 tornou o `canonicalEvent` explícito a única fonte da comparação shadow no mock interno. O próximo passo da migração precisa demonstrar que o canônico pode ser rastreado além da simples resposta de compatibilidade, mas ainda sem introduzir uma segunda publicação, persistência adicional ou impacto nos consumidores existentes.

O barramento atual continua responsável por persistir o payload legado no outbox e entregá-lo aos assinantes webhook e SSE. Alterar essa fronteira neste momento aumentaria o raio de mudança antes de existir evidência operacional suficiente sobre o contrato canônico.

## Decisão

Quando o mock interno recebe um `canonicalEvent` explícito no caminho ALRT → AXE em modo teste, ele passa a emitir o evento estruturado `eventbus.canonical_shadow_observed` depois da comparação shadow.

O registro contém somente metadados necessários à observabilidade:

- `correlationId`;
- `eventId`;
- `type`;
- `simulated`;
- `equivalent`.

O resultado `equivalent` reutiliza a mesma comparação já executada por `toAlrtAxeEvent()`, evitando uma segunda projeção ou uma fonte paralela de decisão.

## Limites de segurança

- não há segunda chamada a `publishEvent()`;
- não há novo registro de outbox;
- o payload persistido no outbox permanece legado;
- webhook e SSE permanecem recebendo o payload legado;
- não existe tráfego HTTP adicional;
- não há alteração de autenticação, API key, HMAC ou retries;
- não há banco ou migration novos;
- sem `canonicalEvent` explícito, nenhuma observação canônica é emitida;
- divergência ou canônico inválido continuam não bloqueantes para o mock.

## Consequências

A plataforma passa a produzir evidência estruturada e correlacionável de que o evento canônico chegou ao caminho shadow e de qual foi o resultado da equivalência, sem transformar o canônico em payload de entrega ou persistência produtiva.

A principal limitação permanece intencional: essa observabilidade não é ainda uma publicação canônica no barramento e não é entregue a consumidores externos.

## Validação

A microentrega segue TDD. O teste definitivo foi criado antes da implementação e falhou porque nenhum evento `eventbus.canonical_shadow_observed` era emitido. Após a implementação mínima, a suíte passa a verificar que um canônico explícito válido gera a observação estruturada com os identificadores, tipo, flag de simulação e resultado da equivalência esperados.

A checagem de tipos, a suíte completa e o build de produção devem permanecer verdes antes do merge.

## Próxima microentrega recomendada

MUE-007: criar um canal shadow interno, somente de teste e sem persistência, capaz de transportar o evento canônico em paralelo ao barramento legado. Outbox, webhook e SSE devem permanecer fora desse canal até novo gate de compatibilidade.
