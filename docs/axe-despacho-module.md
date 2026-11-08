# Central de Alertas como módulo opcional do AXE Despacho

Este repositório permanece independente de `jeffaxe81/dispatch` e continua
mantendo sua própria versão, banco MySQL, credenciais, migrações e CI.

## Integração de pacote

O repositório `jeffaxe81/dispatch` contém o orquestrador
`compose.alerts.yml`. O módulo é construído a partir deste repositório
por um ref versionado (commit imutável), e **não** é importado para a
árvore de código do despacho. Não existe conexão obrigatória entre os
bancos. O despacho continua operando caso os alertas sejam parados.

O perfil Docker Compose `alerts` habilita serviços separados para
`alerts-mysql`, `alerts-migrate` e `alerts-app`. A instalação padrão,
sem o arquivo complementar, não sobe nenhum serviço da Central de Alertas.

O Dockerfile disponibiliza um alvo `migration` para executar migrações
Drizzle antes de iniciar `alerts-app`. As migrações usam exclusivamente
`DATABASE_URL` da Central de Alertas; não existe referência ao banco do
Despacho.

## Saúde

- `GET /health/live`: retorna HTTP 200 quando o servidor Express está vivo;
- `GET /health/ready`: executa consulta simples ao banco independente;
  retorna HTTP 200 ou 503 sem expor erros internos.

Os endpoints não revelam credenciais, tenants nem configurações.

## Segurança e rollout

- A publicação externa ALRT→AXE permanece **desabilitada** por padrão.
- O modo teste/shadow do Motor Universal permanece inalterado.
- Configure `JWT_SECRET` da Central independentemente do `JWT_SECRET`
  do Despacho; não compartilhe credenciais entre módulos.
- Não habilite destinos reais sem contrato autenticado, teste de
  idempotência, trilha de auditoria e homologação aprovada.
- Para rollback, pare apenas o perfil `alerts`; não altere os volumes
  do Despacho. Preserve o volume de dados antes de qualquer downgrade.
