export type TenantScoped = { tenantId: string };

export function assertTenantAccess<T extends TenantScoped>(resource: T, tenantId: string): T {
  if (!tenantId || resource.tenantId !== tenantId) {
    throw new Error("Recurso não pertence ao tenant autenticado.");
  }
  return resource;
}

export function belongsToTenant(resource: TenantScoped | null | undefined, tenantId: string) {
  return Boolean(resource && tenantId && resource.tenantId === tenantId);
}
