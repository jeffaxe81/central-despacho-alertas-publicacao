import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { hashPassword } from "./passwordAuth";

const dbMock = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  createPasswordUser: vi.fn(),
  recordPasswordLogin: vi.fn(),
  getGeneralSettings: vi.fn(),
}));
const sdkMock = vi.hoisted(() => ({ createSessionToken: vi.fn() }));

vi.mock("./db", () => dbMock);
vi.mock("./_core/sdk", () => ({ sdk: sdkMock }));

import { appRouter } from "./routers";

const user = {
  id: 42,
  openId: "local_test_account",
  name: "Ana Teste",
  email: "ana@example.com",
  passwordHash: "",
  loginMethod: "password",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(userContext: TrpcContext["user"] = null) {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx = {
    user: userContext,
    req: { protocol: "https", headers: {} },
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      clearCookie: vi.fn(),
    },
  } as unknown as TrpcContext;
  return { ctx, cookies };
}

describe("auth com senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkMock.createSessionToken.mockResolvedValue("sessao-assinada");
  });

  it("cria uma conta aberta, protege a senha e inicia uma sessão", async () => {
    dbMock.getUserByEmail.mockResolvedValue(undefined);
    dbMock.createPasswordUser.mockResolvedValue({ ...user, passwordHash: "scrypt$salt$hash" });
    const { ctx, cookies } = createContext();

    const result = await appRouter.createCaller(ctx).auth.register({ name: "Ana Teste", email: "ana@example.com", password: "UmaSenhaForte!2026" });

    expect(result.email).toBe("ana@example.com");
    expect(dbMock.createPasswordUser).toHaveBeenCalledWith(expect.objectContaining({ email: "ana@example.com", passwordHash: expect.stringMatching(/^scrypt\$/) }));
    expect(cookies[0]).toMatchObject({ name: "app_session_id", value: "sessao-assinada" });
  });

  it("rejeita login com senha inválida", async () => {
    dbMock.getUserByEmail.mockResolvedValue({ ...user, passwordHash: await hashPassword("UmaSenhaForte!2026") });
    const { ctx } = createContext();

    await expect(appRouter.createCaller(ctx).auth.login({ email: "ana@example.com", password: "SenhaIncorreta!2026" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("aceita login válido, atualiza último acesso e inicia sessão", async () => {
    dbMock.getUserByEmail.mockResolvedValue({ ...user, passwordHash: await hashPassword("UmaSenhaForte!2026") });
    const { ctx, cookies } = createContext();

    const result = await appRouter.createCaller(ctx).auth.login({ email: "ana@example.com", password: "UmaSenhaForte!2026" });

    expect(result.id).toBe(42);
    expect(dbMock.recordPasswordLogin).toHaveBeenCalledWith(42);
    expect(cookies).toHaveLength(1);
  });

  it("rejeita procedimento protegido sem sessão e o permite para uma conta local autenticada", async () => {
    const anonymous = createContext();
    await expect( appRouter.createCaller(anonymous.ctx).alerts.generalSettings()).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    dbMock.getGeneralSettings.mockResolvedValue({ userId: 42, defaultLatitude: -15.793889, defaultLongitude: -47.882778 });
    const { passwordHash: _passwordHash, ...localSessionUser } = user;
    const authenticated = createContext(localSessionUser);
    await expect(appRouter.createCaller(authenticated.ctx).alerts.generalSettings()).resolves.toMatchObject({ userId: 42 });
    expect(dbMock.getGeneralSettings).toHaveBeenCalledWith(42);
  });
});
