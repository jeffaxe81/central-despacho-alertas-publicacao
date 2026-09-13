import { describe, expect, it } from "vitest";
import { assertTenantAccess, belongsToTenant } from "./tenantScope";

describe("tenantScope", () => {
  it("aceita recurso do tenant autenticado", () => {
    const resource = { id: 10, tenantId: "tenant-a" };
    expect(assertTenantAccess(resource, "tenant-a")).toBe(resource);
    expect(belongsToTenant(resource, "tenant-a")).toBe(true);
  });

  it("rejeita recurso de outro tenant", () => {
    const resource = { id: 10, tenantId: "tenant-b" };
    expect(() => assertTenantAccess(resource, "tenant-a")).toThrow("não pertence ao tenant");
    expect(belongsToTenant(resource, "tenant-a")).toBe(false);
  });

  it("rejeita tenant ausente e recursos nulos", () => {
    expect(() => assertTenantAccess({ tenantId: "tenant-a" }, "")).toThrow();
    expect(belongsToTenant(undefined, "tenant-a")).toBe(false);
    expect(belongsToTenant(null, "tenant-a")).toBe(false);
  });
});
