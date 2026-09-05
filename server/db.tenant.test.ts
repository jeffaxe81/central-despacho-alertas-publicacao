import { describe, expect, it } from "vitest";
import { getUserTenantId } from "./db";
import { DEFAULT_TENANT_ID } from "../shared/tenant";

describe("getUserTenantId", () => {
  it("retorna o tenant padrão quando o banco não está disponível (sem DATABASE_URL)", async () => {
    // Neste ambiente de testes não há DATABASE_URL configurada, então getDb()
    // retorna null e a função deve cair no default sem lançar erro. A
    // verificação de que o valor real vem da tabela `users` em um banco vivo
    // não é possível aqui sem um banco real (ver relatorio-conformidade-master.md).
    const result = await getUserTenantId(999999);
    expect(result).toBe(DEFAULT_TENANT_ID);
  });
});
