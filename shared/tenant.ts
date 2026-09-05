/**
 * Multi-tenant (Seção 10 do Prompt Master).
 *
 * A instalação atual opera como single-tenant. O modelo escolhido para a
 * futura separação por empresa é Shared Database + tenant_id (o preferencial
 * indicado pelo Master). Este ciclo apenas prepara a coluna `tenant_id`
 * (aditiva, com valor padrão) em cada tabela relevante; nenhuma query foi
 * alterada para filtrar por tenant ainda — isso é o próximo incremento,
 * registrado em backlog, para não misturar mudança de schema com mudança de
 * regra de negócio no mesmo ciclo (Seção 26, unidades independentes).
 */
export const DEFAULT_TENANT_ID = "default";
