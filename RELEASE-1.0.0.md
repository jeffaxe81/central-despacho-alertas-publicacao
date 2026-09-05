# Release 1.0.0 — Motor de Eventos (Central de Alertas Urbanas)

**Relatório de final de ciclo, conforme Seção 43 do Prompt Master**

---

## Objetivo
Adequar o Motor de Eventos ao Prompt Master do ecossistema Axesistemas e preparar compatibilidade/integração com o Despacho (AXE) e o CRM.

## Escopo
5 sub-ciclos, cada um com árvore validada (testes + tipagem) antes do commit:

| # | Commit | Resumo |
| --- | --- | --- |
| 1 | `53d5819` | Proposta de contrato versionado ALRT → CRM (modo teste, sem endpoint) + relatório de conformidade inicial |
| 2 | `cf921cc` | Extração do Framework Universal de Conectores (Seção 9): registro declarativo, teste de contrato automático |
| 3 | `20fd283` | Dispatcher (`alertEngine.ts`) passa a consultar o registro de conectores; trava de segurança para conectores "proposta" |
| 4 | `b686cb5` | Multi-tenant Fase 1 (Seção 10): coluna `tenant_id` em todas as tabelas, migração `0010_add_tenant_id.sql` |
| 5 | `7d20e33` | Multi-tenant Fase 2: escritas passam a carimbar o `tenant_id` real do usuário |

## Arquivos alterados/criados (cumulativo)
- `shared/alertSimulation.ts` (novo template CRM)
- `shared/connectors/types.ts`, `shared/connectors/registry.ts`, `shared/connectors/registry.contract.test.ts` (novos)
- `shared/tenant.ts` (novo)
- `client/src/lib/connectorProfile.ts` (novo), `alrtAxeProfile.ts`, `alrtCrmProfile.ts` (refatorados para wrappers), `alrtCrmProfile.test.ts` (novo)
- `client/src/pages/Home.tsx` (integração dos conectores na UI)
- `server/alertEngine.ts` (`matchConnectorByPayload`, trava de segurança), `alertEngine.test.ts` (testes novos)
- `server/db.ts` (`getUserTenantId`, propagação de `tenantId` nas escritas), `db.tenant.test.ts` (novo)
- `drizzle/schema.ts` (coluna `tenant_id` em 7 tabelas), `drizzle/0010_add_tenant_id.sql` (migração gerada)
- `vitest.config.ts` (correção: `shared/**` não estava incluído nos testes)
- `relatorio-conformidade-master.md` (novo — relatório vivo dos 5 sub-ciclos)

## Arquitetura
- Framework Universal de Conectores implantado em 3 camadas: contrato (`shared/connectors`), UI (`connectorProfile.ts`), dispatcher (`alertEngine.ts`).
- Multi-tenant: modelo Shared Database + `tenant_id` (Seção 10), Fases 1 e 2 concluídas; Fase 3 (filtro de leitura) condicionada a feature multiusuário ainda inexistente.

## Funcionalidades entregues
- Conector CRM proposto (envelope versionado, modo teste obrigatório até contrato oficial).
- Registro de conectores extensível — novo destino = nova entrada de dados, sem duplicar código.
- Bloqueio automático de envio real para conectores não homologados.
- Coluna e propagação de `tenant_id` em todas as tabelas e escritas.

## Testes
- 65 testes automatizados passando, 1 skip pré-existente (health check condicional a ambiente externo).
- `tsc --noEmit` limpo em todos os 5 sub-ciclos.
- Cobertura nova: contrato de conectores (4 testes), bloqueio de conector "proposta" (2 testes), perfil CRM (2 testes), fallback de tenant (1 teste).

## Evidências
- Comandos executados e resultados registrados em cada checkpoint (`pnpm run check`, `pnpm test`) — ver mensagens de commit de `53d5819` a `7d20e33`.
- SHA da árvore taggeada: `7d20e33fd69beb6add6ba72200c24d82f4d06d73`.
- CI: **não verificado** — este repositório não tem pipeline de CI configurado neste diretório (nenhum `.github/workflows` encontrado); portanto não há status de CI a reportar, e isso é declarado explicitamente em vez de presumido.

## Segurança
- Trava server-side impede envio real a conectores sem contrato confirmado (Ciclo 3).
- Nenhum segredo novo foi introduzido no código; token de push usado nesta sessão não foi persistido em nenhum arquivo do repositório nem em memória.

## Bugs encontrados e corrigidos
- `vitest.config.ts` não incluía `shared/**/*.test.ts` — testes de contrato existiam mas nunca rodavam. Corrigido no Ciclo 2.

## Pendências / Limitações declaradas
- Migração `0010_add_tenant_id.sql` **não foi aplicada** a nenhum banco real (sem `DATABASE_URL` de ambiente nesta sessão).
- `getUserTenantId` foi testado apenas no caminho de fallback (sem banco); a leitura real de `users.tenantId` não foi validada contra um banco vivo.
- Contrato oficial do CRM ainda não existe — conector permanece em modo teste, endpoint vazio.

## Backlog (sem prazo, Seção 33)
| Item | Prioridade |
| --- | --- |
| Confirmar contrato oficial do CRM e ativar o conector em produção | Alta |
| Multi-tenant Fase 3 (filtro de leitura), quando houver feature multiusuário por tenant | Média |
| Modelo de publicação por contrato/barramento (Seção 8) em vez de POST direto por categoria | Média |
| Observabilidade formal (logs estruturados, correlation ID ponta a ponta, métricas por destino) | Média |
| Cofre de segredos dedicado para API keys/tokens | Baixa-Média |
| Configurar pipeline de CI (inexistente hoje) | Baixa-Média |

## Versão
**1.0.0** (primeira tag do repositório; `package.json` já declarava esta versão, sem tag correspondente até agora).

## Riscos
- Sem CI, cada push depende de validação manual local (como feita nesta sessão) — risco de regressão não pega automaticamente em pushes futuros feitos por outra via.
- `tenant_id` com default fixo `"default"` funciona hoje porque só há um tenant real; se um segundo tenant for introduzido sem revisar a Fase 3, dados continuarão logicamente misturados nas leituras (mitigado hoje porque `userId` já isola).

## Próximos passos sugeridos
1. Configurar CI mínimo (lint + test + typecheck) no repositório.
2. Obter contrato oficial do CRM.
3. Priorizar Fase 3 do multi-tenant quando surgir necessidade real de visão compartilhada por tenant.
