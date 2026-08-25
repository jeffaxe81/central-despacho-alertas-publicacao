import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { History, LayoutDashboard, LogIn, LogOut, PanelLeft, RadioTower, Settings2, UserPlus } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const menuItems = [
  { icon: LayoutDashboard, label: "Painel", path: "/" },
  { icon: RadioTower, label: "Simulador", path: "/eventos" },
  { icon: History, label: "Histórico", path: "/historico" },
  { icon: Settings2, label: "Integrações", path: "/configuracoes" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const login = trpc.auth.login.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  const register = trpc.auth.register.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  const isPending = login.isPending || register.isPending;

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setFormError(null);
    setConfirmPassword("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (mode === "register" && password !== confirmPassword) {
      setFormError("A confirmação de senha deve ser igual à senha informada.");
      return;
    }

    try {
      if (mode === "register") {
        await register.mutateAsync({ name, email, password });
      } else {
        await login.mutateAsync({ email, password });
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível concluir a autenticação.");
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-10">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-2xl shadow-black/25 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative hidden overflow-hidden border-r border-primary/15 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.28),transparent_42%),linear-gradient(145deg,hsl(var(--card)),hsl(var(--background)))] p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3 text-primary">
            <RadioTower className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Central de Alertas</span>
          </div>
          <div className="max-w-md">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Acesso operacional seguro</p>
            <h1 className="text-4xl font-semibold tracking-tight">Controle simulações, integrações e entregas em um único painel.</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">Crie sua conta para configurar alertas por categoria, testar despachos e consultar o histórico auditável da operação.</p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-background/35 p-4 text-sm text-muted-foreground backdrop-blur">
            Cada conta mantém seus alertas, configurações e histórico isolados.
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <div className="mb-4 flex items-center gap-2 text-primary"><RadioTower className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-[0.18em]">Central de Alertas</span></div>
              <p className="text-sm text-muted-foreground">Acesse o painel de despacho urbano.</p>
            </div>
            <div className="mb-6 flex gap-2 rounded-xl bg-muted/45 p-1" role="tablist" aria-label="Opções de acesso">
              <Button type="button" variant={mode === "login" ? "default" : "ghost"} className="flex-1" onClick={() => switchMode("login")}><LogIn className="mr-2 h-4 w-4" />Entrar</Button>
              <Button type="button" variant={mode === "register" ? "default" : "ghost"} className="flex-1" onClick={() => switchMode("register")}><UserPlus className="mr-2 h-4 w-4" />Criar conta</Button>
            </div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Acesse sua conta" : "Crie seu acesso"}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === "login" ? "Use o e-mail e a senha cadastrados para abrir o painel." : "O cadastro é aberto. Sua conta começa em modo seguro de simulação."}</p>
            </div>
            <form className="space-y-4" onSubmit={submit}>
              {mode === "register" ? <div className="space-y-2"><Label htmlFor="name">Nome</Label><Input id="name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={120} placeholder="Seu nome" /></div> : null}
              <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required placeholder="voce@exemplo.com" /></div>
              <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={10} maxLength={128} placeholder="Mínimo de 10 caracteres" /></div>
              {mode === "register" ? <div className="space-y-2"><Label htmlFor="confirm-password">Confirmar senha</Label><Input id="confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={10} maxLength={128} placeholder="Repita a senha" /></div> : null}
              {formError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p> : null}
              <Button type="submit" className="w-full" size="lg" disabled={isPending}>{isPending ? "Processando…" : mode === "login" ? "Entrar no painel" : "Criar conta e acessar"}</Button>
            </form>
            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">Ao criar uma conta, você terá um espaço de operação separado para suas configurações e entregas.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    Central de Alertas
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
