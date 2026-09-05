# Rodando localmente com Docker

**Atenção:** o `Dockerfile` e o `docker-compose.yml` foram criados e têm sintaxe validada, mas **não foi possível testar o build/execução real** nesta sessão — o ambiente de trabalho usado não tem Docker instalado. Teste no seu ambiente antes de considerar isso pronto para uso contínuo.

## Subir tudo (app + MySQL)

```bash
docker compose up --build
```

Isso sobe:
- **mysql**: MySQL 8.4, banco `central_alertas`, usuário `alertas`/`alertas_local`, exposto em `localhost:3306`
- **app**: build de produção da aplicação, exposta em `localhost:3000`

## Aplicar as migrações pendentes

As migrações já geradas (`drizzle/0010_add_tenant_id.sql`, `drizzle/0011_add_event_bus.sql`, e as anteriores) ainda **não foram aplicadas** a nenhum banco. Com o MySQL do compose no ar:

```bash
DATABASE_URL="mysql://alertas:alertas_local@localhost:3306/central_alertas" pnpm exec drizzle-kit migrate
```

## Variáveis de ambiente

O `docker-compose.yml` já define `DATABASE_URL` apontando para o serviço `mysql`. As demais variáveis (`JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, etc. — ver `server/_core/env.ts`) têm fallback vazio no código; adicione-as ao `environment:` do serviço `app` no `docker-compose.yml` se e quando forem necessárias.

## Parar e limpar

```bash
docker compose down          # para os containers, mantém o volume do banco
docker compose down -v       # para e apaga também os dados do MySQL
```
