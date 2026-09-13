import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  APP_LOGO,
  APP_LOGO_WHITE_NO_IMOB,
  getLoginUrl,
  getRegisterUrl,
} from "@/const";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@shared/auth";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import NotificationBell from "@/components/NotificationBell";
import {
  Bot,
  BookOpenCheck,
  CalendarDays,
  CircleDollarSign,
  Briefcase,
  Building2,
  Gift,
  MessageSquare,
  Target,
  Hammer,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Phone,
  PlugZap,
  Settings,
  Sun,
  User,
  Users,
} from "lucide-react";

export default function Header() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [hideForFooter, setHideForFooter] = useState(false);

  // Rotas onde o header NÃO deve sumir ao chegar no rodapé.
  const disableHideOnFooterRoutes = new Set(["/admin", "/admin/parametros"]);
  const shouldObserveFooter = !disableHideOnFooterRoutes.has(location);

  // Esconde o header quando o rodapé entra em cena (rolando até o final).
  useEffect(() => {
    if (!shouldObserveFooter) {
      setHideForFooter(false);
      return;
    }
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          setHideForFooter(entry.isIntersecting);
        }
      },
      { root: null, threshold: 0.1 }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [location, shouldObserveFooter]);
  const isRootAdmin =
    user?.role === "administrativo" && user?.registrationSource === "bootstrap";
  const isStaff = user?.role === "administrativo" || user?.role === "corretor";
  const brandHref = isStaff ? "/dashboard" : "/";

  const { data: hasNewUsers } = trpc.admin.hasNewUsers.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
    refetchOnWindowFocus: true,
  });

  const { data: taskSummary } = trpc.tasks.summary.useQuery(undefined, {
    enabled: isAuthenticated && isStaff,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const publicMenuItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/imoveis", label: "Im\u00f3veis", icon: Building2 },
    { href: "/lancamentos", label: "Lan\u00e7amentos", icon: Hammer },
    { href: "/servicos", label: "Nossos Servi\u00e7os", icon: Briefcase },
    { href: "/contato", label: "Fale Conosco", icon: Phone },
  ];

  const clienteMenuItems = [
    { href: "/area-cliente", label: "\u00c1rea do Cliente", icon: User },
  ];

  const corretorMenuItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/crm", label: "CRM", icon: LayoutDashboard },
    { href: "/meus-imoveis", label: "Meus Im\u00f3veis", icon: Building2 },
  ];

  const adminMenuItems = [
    { href: "/admin/users", label: "Usu\u00e1rios", icon: Users },
    { href: "/crm", label: "CRM", icon: LayoutDashboard },
    { href: "/admin", label: "Administrativo", icon: Briefcase },
    { href: "/financeiro", label: "Financeiro", icon: CircleDollarSign },
  ];

  const getMenuItems = () => {
    const dashboardItem = {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    };

    const items =
      isAuthenticated && user?.role === "administrativo"
        ? [
            dashboardItem,
            ...publicMenuItems.filter(
              item =>
                item.href !== "/" &&
                item.href !== "/contato" &&
                item.href !== "/servicos"
            ),
          ]
        : isAuthenticated && user?.role === "corretor"
          ? [
              dashboardItem,
              ...publicMenuItems.filter(
                item => item.href !== "/" && item.href !== "/contato"
              ),
            ]
          : [...publicMenuItems];

    if (isAuthenticated && user) {
      if (user.role === "cliente") {
        items.push(...clienteMenuItems);
      } else if (user.role === "corretor") {
        items.push(
          ...corretorMenuItems.filter(item => item.href !== "/dashboard")
        );
      } else if (user.role === "administrativo") {
        items.push(
          ...adminMenuItems.filter(item => item.href !== "/admin/users")
        );
      }
    }

    return items;
  };

  const menuItems = getMenuItems();

  const getDesktopNavClassName = (href: string) => {
    const isActive = location === href;

    return isActive
      ? "flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 shadow-sm ring-1 ring-emerald-100 transition-colors dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30"
      : "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-emerald-50/70 hover:text-emerald-900 dark:text-slate-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200";
  };

  const getMobileNavClassName = (href: string) => {
    const isActive = location === href;

    return isActive
      ? "flex items-center gap-3 rounded-2xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900 ring-1 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30"
      : "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-emerald-50/70 hover:text-emerald-900 dark:text-slate-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200";
  };

  const handleMenuNavigation = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    closeMobile = false
  ) => {
    if (closeMobile) {
      setMobileMenuOpen(false);
    }

    if (typeof window === "undefined") return;

    if (window.location.pathname === href) {
      event.preventDefault();
      window.location.assign(href);
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b border-[#e5e3da] bg-[#f8f7f2]/92 backdrop-blur transition-transform duration-300 supports-[backdrop-filter]:bg-[#f8f7f2]/80 dark:border-white/10 dark:bg-[#1e1e1e]/92 dark:supports-[backdrop-filter]:bg-[#1e1e1e]/80 ${
        hideForFooter
          ? "-translate-y-full pointer-events-none"
          : "translate-y-0"
      }`}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link href={brandHref}>
          <a className="flex items-center gap-3 transition-opacity hover:opacity-80">
            {/* Logo preta para modo claro */}
            <img
              src={APP_LOGO}
              alt="New Imob"
              className="h-10 w-auto object-contain drop-shadow-sm dark:hidden md:h-11 [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.25))_drop-shadow(0_2px_3px_rgba(0,0,0,0.15))]"
            />
            {/* Logo branca para modo escuro (versão sem "Imob", mesma
                proporção da preta) */}
            <img
              src={APP_LOGO_WHITE_NO_IMOB}
              alt="New Imob"
              className="hidden h-10 w-auto object-contain md:h-11 dark:block [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.5))_drop-shadow(0_2px_4px_rgba(255,255,255,0.1))]"
            />
          </a>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {menuItems.map(item => (
            <Link key={item.href} href={item.href}>
              <a
                className={getDesktopNavClassName(item.href)}
                onClick={event => handleMenuNavigation(event, item.href)}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.href === "/admin/users" && hasNewUsers ? (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-700"
                      aria-label="Existem novos cadastros"
                      title="Existem novos cadastros"
                    />
                  ) : null}
                </span>
              </a>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded bg-muted" />
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-1.5">
              {isStaff ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-full border-0 bg-transparent p-0 text-slate-600 shadow-none hover:bg-emerald-50/60 hover:text-emerald-900 dark:text-slate-200 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-200"
                  onClick={() => setLocation("/tarefas-eventos")}
                  aria-label="Abrir tarefas e eventos"
                  title="Tarefas e Eventos"
                >
                  <CalendarDays className="h-5 w-5" />
                  {(taskSummary?.assignedUnseenCount ?? 0) > 0 ? (
                    <span className="absolute right-0.5 top-0.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-emerald-700 px-1 text-[10px] font-semibold text-white">
                      {Math.min(taskSummary?.assignedUnseenCount ?? 0, 99)}
                    </span>
                  ) : null}
                </Button>
              ) : null}

              {isStaff ? <NotificationBell /> : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-full border-[#d8d6ca] bg-white/80 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 dark:border-white/20 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-200"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {user.name || user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="rounded-sm px-2 py-1.5 text-sm">
                    <p className="font-medium">{user.name || "Usu\u00e1rio"}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Papel: {ROLE_LABELS[user.role]}
                    </p>
                  </div>
                  {!isRootAdmin ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/minha-ficha">
                          <a className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Meu Perfil
                          </a>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {toggleTheme && isRootAdmin ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => toggleTheme()}
                        className="cursor-pointer gap-2"
                      >
                        {theme === "dark" ? (
                          <Sun className="h-4 w-4" />
                        ) : (
                          <Moon className="h-4 w-4" />
                        )}
                        {theme === "dark"
                          ? "Voltar para modo claro"
                          : "Ativar modo escuro (Beta)"}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {isStaff ? (
                    <>
                      <DropdownMenuSeparator />
                      <PushNotificationToggle />
                      <DropdownMenuItem asChild>
                        <Link href="/roleta-atendimentos">
                          <a className="flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Roleta de Atendimentos
                          </a>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {user.role === "administrativo" ? (
                    <DropdownMenuItem asChild>
                      <Link href="/controle-de-chaves">
                        <a className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4" />
                          Controle de Chaves
                        </a>
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {isStaff ? (
                    <DropdownMenuItem asChild>
                      <Link href="/condominios">
                        <a className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Condomínios
                        </a>
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {user.role === "administrativo" ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/bonificacoes">
                          <a className="flex items-center gap-2">
                            <Gift className="h-4 w-4" />
                            Bonificações
                          </a>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/evolucao-profissional">
                          <a className="flex items-center gap-2">
                            <BookOpenCheck className="h-4 w-4" />
                            Evolução Profissional
                          </a>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/automacao">
                          <a className="flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            Automações
                          </a>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/integracoes">
                          <a className="flex items-center gap-2">
                            <PlugZap className="h-4 w-4" />
                            Integrações
                          </a>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {user.role === "administrativo" ? (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/users">
                        <a className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Usuários
                          {hasNewUsers ? (
                            <span
                              className="ml-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-700"
                              aria-label="Existem novos cadastros"
                              title="Existem novos cadastros"
                            />
                          ) : null}
                        </a>
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {user.role === "administrativo" ? (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/integracoes/botconversa">
                        <a className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          BotConversa
                        </a>
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {user.role === "administrativo" ? (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/parametros">
                        <a className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Parâmetros do Sistema
                        </a>
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="cursor-pointer gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="hidden rounded-full border-[#d8d6ca] bg-white/80 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 dark:border-white/20 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-200 sm:inline-flex"
              >
                <a href={getRegisterUrl()}>Cadastrar</a>
              </Button>
              <Button
                asChild
                size="sm"
                className="rounded-full bg-emerald-700 text-white shadow-[0_12px_30px_-18px_rgba(4,120,87,0.8)] hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <a href={getLoginUrl()}>Entrar</a>
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-[#e5e3da] bg-[#f8f7f2] dark:border-white/10 dark:bg-[#1e1e1e] md:hidden">
          <nav className="container flex flex-col gap-2.5 py-4">
            {menuItems.map(item => (
              <Link key={item.href} href={item.href}>
                <a
                  className={getMobileNavClassName(item.href)}
                  onClick={event =>
                    handleMenuNavigation(event, item.href, true)
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex items-center gap-2">
                    <span>{item.label}</span>
                    {item.href === "/admin/users" && hasNewUsers ? (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-700"
                        aria-label="Existem novos cadastros"
                        title="Existem novos cadastros"
                      />
                    ) : null}
                  </span>
                </a>
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
