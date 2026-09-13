# Avaliação técnica — Central de Despacho de Alertas

**Repositório avaliado:** `jeffaxe81/central-despacho-alertas-publicacao`  
**Versão observada:** `1.12.0`  
**Commit avaliado:** `54f961b` (`Merge PR #9 — MUE-009 observabilidade shadow`)  
**Data da avaliação:** 13 de setembro de 2026  
**Autor:** Manus AI

## Conclusão executiva

O projeto apresenta uma base técnica consistente para um simulador e integrador de alertas urbanos. A separação entre frontend React, API tRPC/Express, persistência Drizzle/MySQL, simulação determinística, mock interno e barramento de eventos está bem encaminhada. O código também demonstra preocupação incomum com contratos, rastreabilidade, compatibilidade ALRT → AXE e testes de regressão.

A avaliação geral é **6,8/10**. Para uso local, homologação e demonstração controlada, o projeto está em boa condição. Para exposição pública ou operação produtiva, eu classificaria a prontidão como **condicional**: os fluxos principais funcionam, mas ainda há riscos relevantes de segurança, isolamento multi-tenant, confiabilidade de entrega e operação.

O principal ponto não é uma falha evidente no domínio de alertas. O risco está nas bordas do sistema: endpoints públicos, armazenamento e logs de segredos, validação de destinos HTTP, identidade de agendamentos e semântica do barramento de eventos.

> **Recomendação:** não publicar em produção com endpoints externos habilitados antes de corrigir os itens P0 e P1 da tabela abaixo. O modo teste, com dados fictícios e ambiente isolado, é apropriado para validação funcional.

## Resultado da validação automatizada

| Verificação | Resultado | Observação |
|---|---:|---|
| `pnpm check` | Aprovado | TypeScript sem erros de tipagem. |
| `pnpm test` | **112 aprovados, 1 ignorado** | 28 arquivos passaram; 1 teste de integração AXE foi ignorado. |
| `pnpm build` | Aprovado | Frontend e bundle do servidor foram gerados. |
| Instalação | Aprovada | `pnpm install --frozen-lockfile` concluiu. |
| Avisos de build | Existem | Variáveis de analytics ausentes, script externo sem `type="module"` e chunk frontend acima de 500 kB. |
| Aviso do gerenciador | Existe | O `pnpm` utilizado informa que o campo `pnpm` no `package.json` deixou de ser lido; overrides e patch podem não estar sendo aplicados. |

A suíte é uma evidência positiva de qualidade de domínio, mas não comprova segurança de produção. Não foram encontrados testes end-to-end contra um MySQL real, testes de concorrência, testes de abuso de API, testes de SSRF, testes de rotação/revogação de credenciais ou teste completo do agendador externo.

## Pontos fortes

### Arquitetura e domínio

O fluxo de geração possui semente de simulação, correlação e coordenadas explícitas. Isso favorece repetibilidade, auditoria e diagnóstico. O dispatcher também mantém uma fronteira clara entre modo teste e entrega real.

A implementação do envelope canônico e do adaptador ALRT → AXE é progressiva e reversível. O caminho shadow permanece limitado ao modo teste, sem alterar a entrega real. Essa escolha reduz o risco de migração de contrato e está refletida nos ADRs e nos testes.

O barramento registra outbox antes do fan-out para assinantes e trata falhas de consumidores sem derrubar o despacho principal. O mecanismo de retries contempla erros de rede, respostas 5xx e `429`, com leitura de `Retry-After`.

### Validação de entrada e isolamento funcional

As entradas de configuração usam Zod com limites de tamanho e validação de coordenadas. O payload de workflow possui schema explícito e deduplicação por `(alertTypeId, externalId)`. As consultas de negócio normalmente filtram por `userId`, e os campos sensíveis de tipos de alerta não são devolvidos diretamente ao frontend.

Senhas locais são derivadas com `scrypt`, salt aleatório e comparação em tempo constante. O projeto também evita versionar arquivos `.env` e artefatos comuns de segredo.

### Qualidade e documentação

A cobertura funcional é ampla para um projeto desse porte: motor de alertas, contratos canônicos, mock, autenticação local, workflow, assinaturas, SSE, persistência e componentes de interface possuem testes. A documentação inclui README, ADRs, instruções de acesso, validações e releases incrementais.

## Riscos prioritários

| Prioridade | Constatação | Evidência | Impacto | Recomendação |
|---|---|---|---|---|
| **P0** | O segredo JWT pode ficar vazio se `JWT_SECRET` não for configurado. | `server/_core/env.ts:3` usa `process.env.JWT_SECRET ?? ""`; `server/_core/sdk.ts:156-196` assina e valida HS256 com esse valor. | Se a aplicação subir com configuração incompleta, sessões podem ser forjadas ou a segurança pode ficar dependente de uma chave pública/conhecida. | Falhar no startup em produção quando o segredo estiver ausente, curto ou reutilizado. Validar comprimento mínimo e usar segredo gerado por ambiente. Adicionar teste de bootstrap seguro. |
| **P0** | As rotas HTTP de integração não têm limite de taxa, proteção contra abuso ou limite pequeno de corpo. | `server/_core/index.ts:39` aceita JSON e URL-encoded de até `50mb`; `/api/integrations/occurrences` é registrado em `workflowRoutes.ts:6`; `/api/events/stream` é público mediante chave. | Um atacante com uma API key pode gerar custo, crescimento de banco, saturação de conexões ou conexões SSE excessivas. | Aplicar rate limit por API key/IP, limite específico por rota, timeout, limite de conexões SSE e métricas/alertas de abuso. |
| **P0** | O bloqueio de endpoints privados é apenas textual e não resolve DNS nem IPv6 de forma robusta. | `server/alertEngine.ts:285-308` bloqueia alguns hosts e prefixos IPv4, mas não resolve o destino antes da conexão; não cobre completamente IPv6, loopback mapeado, link-local, ranges especiais e DNS rebinding. | A configuração de webhook pode ser abusada para SSRF contra serviços internos, metadata de cloud ou painéis administrativos. | Resolver o hostname, validar todos os IPs resultantes contra uma allow/deny list de redes reservadas e conectar usando o IP validado. Revalidar redirects e desabilitar redirects automáticos. Preferir allowlist de destinos em produção. |
| **P1** | Segredos são armazenados em texto puro no banco. | `drizzle/schema.ts:73-77` guarda `authToken` e `apiKey` como `text`; `eventSubscriptions` guarda `outboundApiKey` e `subscriberApiKey` diretamente. | Vazamento de backup, dump, acesso de suporte ou SQL expõe credenciais reutilizáveis. | Criptografar em repouso com envelope encryption/KMS ou, no mínimo, armazenar hash para chaves de entrada e cifrar tokens de saída. Implementar rotação e revogação. |
| **P1** | O endpoint de workflow registra o payload bruto em logs de processo, inclusive em falhas de autenticação. | `server/workflowReceiver.ts:40-46,51-52,58-59,78` passa `JSON.stringify(rawPayload)` para `createWorkflowProcessLog`; o banco persiste `payloadJson`. | Narrativas, identificadores e possíveis dados sensíveis permanecem duplicados e ampliam a superfície de exposição. | Redigir/mascarar campos sensíveis, limitar tamanho persistido, configurar retenção e separar auditoria de payload operacional. Nunca persistir credenciais recebidas. |
| **P1** | A publicação no barramento ocorre antes da entrega primária e pode ser síncrona e lenta. | `server/alertEngine.ts:445-456` chama `publishEvent()` antes de `deliverToInternalMock()` ou `postWithRetry()`; `server/eventBus/publish.ts:69-109` faz fan-out sequencial e pode aguardar até três retries por webhook. | Um assinante lento ou indisponível aumenta a latência do despacho principal. Além disso, assinantes podem receber um evento mesmo quando a entrega primária falha, o que pode gerar semântica inesperada para consumidores. | Definir explicitamente a semântica: evento de intenção, aceitação ou sucesso. Para não bloquear o despacho, publicar de forma assíncrona via worker/outbox. Se o evento significar sucesso, publicar após a confirmação primária. |
| **P1** | A outbox é gravada, mas não há worker de replay/recuperação implementado no caminho avaliado. | `server/eventBus/publish.ts:17-21,27-47` grava e entrega na mesma chamada; `eventOutbox` possui estados, mas não foi identificado consumidor que reprocesse pendências/falhas. | Falhas após a gravação podem permanecer apenas como auditoria. O modelo parece durável, mas ainda não oferece entrega eventual garantida. | Criar worker idempotente para ler `pending`, `partial` e `failed`, com lease, backoff, tentativas máximas, dead-letter e métricas. |
| **P1** | A chave do workflow é consultada globalmente e não há unicidade no schema. | `server/db.ts:272-276` busca `apiKey` sem tenant/usuário; `drizzle/schema.ts:75` não marca `apiKey` como única. | Reutilização acidental de chave pode associar uma chamada ao primeiro alerta encontrado e causar roteamento entre contas. | Gerar chaves com alta entropia, armazenar hash, adicionar índice único e resolver explicitamente o tenant/alert type da credencial. |
| **P1** | O isolamento multi-tenant ainda depende principalmente de `userId`, apesar da existência de `tenantId`. | `server/db.ts:150-155` declara que leituras continuam filtradas por usuário; várias consultas operacionais usam apenas `userId`, enquanto a outbox usa `tenantId`. | A evolução para múltiplos usuários por tenant pode introduzir vazamento ou comportamento inconsistente. | Tornar `tenantId` parte obrigatória de todas as leituras e escritas. Obter o tenant do contexto autenticado, não de dados mutáveis do usuário. Adicionar testes negativos entre tenants. |
| **P1** | O endpoint SSE aceita API key em query string. | `server/eventBus/sseRoute.ts:9-13` usa `req.query.api_key` como fallback. | Chaves podem aparecer em logs de proxy, histórico, métricas e ferramentas de observabilidade. | Preferir cookie de sessão específico ou `Authorization` via cliente compatível. Se query string for inevitável, usar token curto, revogável, de uso limitado e redigir o parâmetro em logs. |
| **P2** | Cookies usam `SameSite=None` mesmo quando não há necessidade demonstrada de contexto cross-site. | `server/_core/cookies.ts:42-47`. | Aumenta a superfície de CSRF; não foi identificada proteção CSRF explícita para mutations autenticadas por cookie. | Usar `SameSite=Lax` por padrão. Se cross-site for obrigatório, aplicar token CSRF, validação de `Origin`/`Referer` e política de domínio restrita. |
| **P2** | O segredo HMAC ALRT → AXE é global e exigido somente no envio. | `server/alertEngine.ts:497-501` lê `AXE_HMAC_SECRET` de ambiente. | Rotação por integração e revogação independente não são possíveis; a configuração de homologação pode ficar acoplada ao processo. | Modelar segredo por conector/tenant, com rotação, versão de chave e janela de tolerância. |
| **P2** | Exceções retornam contexto operacional ao cliente. | `server/scheduledAlerts.ts:25-31` devolve `error`, `timestamp` e `context.url`. | Mensagens internas podem revelar configuração, integração ou estrutura de rotas. | Retornar erro genérico ao cliente e registrar detalhes apenas no log correlacionado. |
| **P2** | O build possui sinais de configuração incompleta e bundle inicial grande. | Saída do build aponta variáveis de analytics ausentes, script externo sem `type="module"` e chunk de 634 kB. | Pode haver telemetria quebrada, warning ocultando problema de template e piora no carregamento inicial. | Tornar analytics opcional de forma explícita, corrigir o script e aplicar code splitting por tela. |
| **P2** | O `package.json` contém configuração de `pnpm` que o gerenciador usado reportou como ignorada. | Saída de `pnpm` informou que `pnpm.patchedDependencies` e `pnpm.overrides` não são mais lidos nesse campo. | O build pode usar dependências diferentes das esperadas e o patch de `wouter` ou override de `nanoid` pode não estar efetivo. | Migrar a configuração para o arquivo suportado pela versão do pnpm adotada, fixar a versão no CI e verificar o lockfile em instalação limpa. |

## Observações específicas de implementação

### Autenticação

O fluxo de senha local é bem melhor que um armazenamento ingênuo: usa `scrypt`, salt individual e `timingSafeEqual`. Entretanto, não há evidência de limitação de tentativas de login, bloqueio progressivo, MFA ou expiração curta de sessão. A sessão padrão dura um ano (`ONE_YEAR_MS`), o que é confortável para um protótipo, mas excessivo para uma aplicação operacional que manipula integrações e credenciais.

A aplicação também aceita o token de sessão via `Authorization: Bearer`, além de cookie. Essa compatibilidade pode ser necessária para preview e WebView, mas deve ser acompanhada de política clara para evitar que tokens sejam enviados ou registrados por engano.

### Entrega e retries

O retry de três tentativas é simples e compreensível. Ele trata `429` como retentável e respeita `Retry-After` com teto de 45 segundos. A implementação, porém, não usa jitter e aguarda dentro da requisição que iniciou o despacho. Em volume maior, isso pode prender recursos do servidor e multiplicar chamadas concorrentes.

Uma fila de entrega com idempotência, lease e backoff exponencial seria mais adequada para a parte produtiva. O `idempotency-key` já aparece no contrato, o que fornece uma boa base para essa evolução.

### Multi-tenant

O código já possui `tenantId` em várias tabelas e registra o tenant nas escritas. Isso é um bom ponto de partida. O próprio comentário em `db.ts` reconhece que as leituras ainda se baseiam em `userId`. Essa decisão é aceitável enquanto cada usuário representar um tenant isolado, mas não deve ser tratada como isolamento multi-tenant completo.

Antes de permitir dois usuários no mesmo tenant, é necessário centralizar a resolução de tenant no contexto autenticado e exigir esse escopo em cada repositório/query. O teste atual de tenant deve ser ampliado para provar que um usuário não acessa alertas, assinaturas, ocorrências ou outbox de outro tenant.

### Dados e retenção

O sistema armazena histórico, payload, resposta HTTP, narrativa, logs de workflow e outbox. Não há política visível de retenção, arquivamento ou expurgo por idade. Para uma operação contínua, o crescimento do banco será proporcional ao volume de alertas e pode afetar índices e custos.

Recomendo definir retenção por tipo de dado, particionamento ou arquivamento para tabelas de alto volume e métricas de tamanho. O botão de limpeza operacional não substitui uma política automática de retenção.

## Plano de ação recomendado

### Antes de qualquer produção pública

1. Tornar `JWT_SECRET`, `DATABASE_URL` e segredos de integração obrigatórios em produção.
2. Corrigir a validação anti-SSRF e criar allowlist de destinos para webhooks.
3. Adicionar rate limit, limite de corpo por rota, timeout de conexão, limite de SSE e proteção contra abuso.
4. Remover payloads brutos e segredos de logs e reduzir a retenção operacional.
5. Corrigir a resolução de API keys e impor unicidade, rotação e revogação.
6. Definir e testar a semântica do evento publicado antes ou depois da entrega primária.

### Para a primeira versão operacional

1. Implementar worker da outbox com retry durável e dead-letter.
2. Completar o isolamento por `tenantId` em todas as queries.
3. Adicionar proteção CSRF ou substituir `SameSite=None` por uma política mais restritiva.
4. Reduzir a duração das sessões e incluir revogação/logout server-side quando necessário.
5. Adicionar testes de segurança, concorrência, integração com MySQL e falhas de rede reais.
6. Corrigir os warnings de build e garantir que overrides/patches do pnpm estejam ativos no CI.

### Para evolução posterior

1. Separar o dispatcher HTTP em worker assíncrono.
2. Adicionar métricas de latência, taxa de retry, idade da outbox, falhas por assinante e conexões SSE.
3. Adicionar circuit breaker por destino externo.
4. Versionar e rotacionar chaves HMAC por integração.
5. Aplicar code splitting e orçamento de bundle no pipeline.

## Veredito

**Aprovado para:** desenvolvimento local, demonstração, homologação controlada e validação de contratos sintéticos.

**Aprovado com ressalvas para:** piloto interno com rede restrita, dados fictícios, poucos usuários e monitoramento manual.

**Não recomendado ainda para:** exposição pública, processamento de dados sensíveis, operação multi-tenant real ou despacho externo de alta criticidade.

A base merece continuidade. O projeto já resolveu várias questões de contrato e teste que normalmente aparecem somente depois de incidentes. A próxima etapa deve deslocar o foco de novas microentregas de contrato para hardening de segurança, entrega assíncrona, isolamento de tenant e operação observável.

## Referências

[1]: https://github.com/jeffaxe81/central-despacho-alertas-publicacao/blob/54f961b/README.md "README do projeto Central de Alertas Urbanos"

[2]: https://github.com/jeffaxe81/central-despacho-alertas-publicacao/blob/54f961b/server/alertEngine.ts "Motor de alertas, retries e despacho"

[3]: https://github.com/jeffaxe81/central-despacho-alertas-publicacao/blob/54f961b/server/eventBus/publish.ts "Publicação no barramento e outbox"

[4]: https://github.com/jeffaxe81/central-despacho-alertas-publicacao/blob/54f961b/server/workflowReceiver.ts "Recepção de ocorrências de workflow"

[5]: https://github.com/jeffaxe81/central-despacho-alertas-publicacao/blob/54f961b/server/_core/index.ts "Bootstrap HTTP do servidor"

[6]: https://github.com/jeffaxe81/central-despacho-alertas-publicacao/blob/54f961b/server/_core/sdk.ts "Sessões e autenticação"

[7]: https://github.com/jeffaxe81/central-despacho-alertas-publicacao/blob/54f961b/drizzle/schema.ts "Schema Drizzle/MySQL"

[8]: https://github.com/jeffaxe81/central-despacho-alertas-publicacao/blob/54f961b/package.json "Scripts e dependências do projeto"
