import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_LOGO, getLoginUrl, getRegisterUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@shared/auth";
import { Menu, User, LogOut, Home, Building2, Briefcase, Phone, Users, LayoutDashboard, Settings } from "lucide-react";
import { useState } from "react";

/**
 * Header Component
 * 
 * Componente de cabeçalho com navegação dinâmica baseada em roles de usuário.
 * 
 * EDIÇÃO:
 * - Para alterar o logo: modifique APP_LOGO em client/src/const.ts
 * - Para alterar o título: modifique APP_TITLE em client/src/const.ts
 * - Para adicionar/remover itens do menu: edite as seções menuItems abaixo
 */
export default function Header() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: hasNewUsers } = trpc.admin.hasNewUsers.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
    refetchOnWindowFocus: true,
  });

  // Menu público (visível para todos)
  const publicMenuItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/imoveis", label: "Imóveis", icon: Building2 },
    { href: "/servicos", label: "Nossos Serviços", icon: Briefcase },
    { href: "/contato", label: "Fale Conosco", icon: Phone },
  ];

  // Menu para clientes autenticados
  const clienteMenuItems = [
    { href: "/area-cliente", label: "Área do Cliente", icon: User },
  ];

  // Menu para corretores
  const corretorMenuItems = [
    { href: "/crm", label: "CRM", icon: LayoutDashboard },
    { href: "/meus-imoveis", label: "Meus Imóveis", icon: Building2 },
  ];

  // Itens para administrativos
  const adminMenuItems = [
    { href: "/admin/users", label: "Usuários", icon: Users },
    { href: "/crm", label: "CRM", icon: LayoutDashboard },
    { href: "/admin", label: "Painel Admin", icon: Settings },
  ];

  // Determina quais itens no cabeçalho mostrar baseado no regra de usuário
  const getMenuItems = () => {
    const items =
      isAuthenticated && user && user.role !== "cliente"
        ? publicMenuItems.filter(item => item.href !== "/contato")
        : [...publicMenuItems];
    
    if (isAuthenticated && user) {
      if (user.role === "cliente") {
        items.push(...clienteMenuItems);
      } else if (user.role === "corretor") {
        items.push(...corretorMenuItems);
      } else if (user.role === "administrativo") {
        items.push(...adminMenuItems);
      }
    }
    
    return items;
  };

  const menuItems = getMenuItems();

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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-15 items-center justify-between">
        {/* Logo e Título */}
        <Link href="/">
          <a className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            {APP_LOGO && (
              <img src={APP_LOGO} className="h-15 w-15 object-contain" />
            )}
          </a>
        </Link>

        {/* Menu Desktop */}
        <nav className="hidden md:flex items-center gap-6">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                onClick={event => handleMenuNavigation(event, item.href)}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.href === "/admin/users" && hasNewUsers ? (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full bg-primary"
                      aria-label="Existem novos cadastros"
                      title="Existem novos cadastros"
                    />
                  ) : null}
                </span>
              </a>
            </Link>
          ))}
        </nav>

        {/* Área de Usuário */}
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-9 w-24 animate-pulse bg-muted rounded" />
          ) : isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.name || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <Link href="/minha-ficha">
                  <a className="block rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent">
                    <p className="font-medium">{user.name || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Papel: {ROLE_LABELS[user.role]}
                    </p>
                  </a>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/minha-ficha">
                    <a className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Meu Perfil
                    </a>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout()} className="gap-2 cursor-pointer">
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                <a href={getRegisterUrl()}>Cadastrar</a>
              </Button>
              <Button asChild size="sm">
                <a href={getLoginUrl()}>Entrar</a>
              </Button>
            </div>
          )}

          {/* Menu Mobile */}
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

      {/* Menu Mobile Expandido */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="container py-4 flex flex-col gap-3">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <a
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                  onClick={event => handleMenuNavigation(event, item.href, true)}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex items-center gap-2">
                    <span>{item.label}</span>
                    {item.href === "/admin/users" && hasNewUsers ? (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full bg-primary"
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
      )}
    </header>
  );
}
