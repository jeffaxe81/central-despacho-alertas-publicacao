# ADR-0003 — Adaptador canônico para ALRT → AXE

- Status: aprovado e implementado de forma isolada
- Data: 2026-09-09
- Decisão: transformação pura com projeção AXE fixa e validação fail-closed

## Contexto

O Motor possui um envelope canônico independente e o AXE possui um contrato de entrada já homologado. Fazer o núcleo gerar diretamente o formato AXE recriaria o acoplamento que a arquitetura universal pretende remover.

## Decisão

`toAlrtAxeEvent(input)` executa duas validações:

1. o envelope deve cumprir o contrato canônico v1 e permanecer `simulation-only`;
2. `data` deve conter a projeção mínima exigida pelo AXE: ativo, categoria, severidade, descrição e localização.

Somente depois dessas validações a função produz `alert.received`. Identidade, horário, correlação e idempotência vêm do evento canônico. A identidade legada `source.system: despacho-alrt`, o ambiente `homologacao` e o estado `novo` são preservados para compatibilidade com o receptor homologado.

## Alternativas avaliadas

- Mapeamento configurável agora: adiado por adicionar complexidade antes de existir um segundo mapeamento real para o mesmo contrato.
- Projeção fornecida pelo chamador: descartada porque deslocaria a responsabilidade de validação para fora do adaptador.

## Consequências

- O núcleo continua sem conhecer o AXE.
- O adaptador pode ser testado sem banco, rede ou credenciais.
- Dados extras do domínio não vazam ao consumidor.
- Entradas incompletas ou inválidas falham antes de qualquer entrega.
- Esta etapa não conecta o adaptador ao barramento nem substitui o fluxo legado.

## Como validar

1. Execute `./node_modules/.bin/vitest run shared/connectors/alrtAxeAdapter.test.ts`.
2. Execute `./node_modules/.bin/tsc --noEmit`.
3. Confirme que a saída contém apenas o envelope homologado.
4. Confirme que prioridade inválida, coordenadas fora do intervalo e evento não sintético são rejeitados.

Se falhar, verifique primeiro se o envelope canônico é válido; depois confira os campos exigidos em `data`. Nenhum erro desta função deve produzir tráfego de rede, porque o adaptador é puro.
