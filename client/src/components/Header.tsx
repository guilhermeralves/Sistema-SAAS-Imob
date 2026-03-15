import { Link } from "wouter";
import { useState } from "react";
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
import {
  Briefcase,
  Building2,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Phone,
  Settings,
  User,
  Users,
} from "lucide-react";

export default function Header() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isRootAdmin =
    user?.role === "administrativo" && user?.registrationSource === "bootstrap";

  const { data: hasNewUsers } = trpc.admin.hasNewUsers.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
    refetchOnWindowFocus: true,
  });

  const publicMenuItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/imoveis", label: "Im\u00f3veis", icon: Building2 },
    { href: "/servicos", label: "Nossos Servi\u00e7os", icon: Briefcase },
    { href: "/contato", label: "Fale Conosco", icon: Phone },
  ];

  const clienteMenuItems = [
    { href: "/area-cliente", label: "\u00c1rea do Cliente", icon: User },
  ];

  const corretorMenuItems = [
    { href: "/crm", label: "CRM", icon: LayoutDashboard },
    { href: "/meus-imoveis", label: "Meus Im\u00f3veis", icon: Building2 },
  ];

  const adminMenuItems = [
    { href: "/admin/users", label: "Usu\u00e1rios", icon: Users },
    { href: "/crm", label: "CRM", icon: LayoutDashboard },
    { href: "/admin", label: "Painel Admin", icon: Settings },
  ];

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
        <Link href="/">
          <a className="flex items-center gap-3 transition-opacity hover:opacity-80">
            {APP_LOGO ? <img src={APP_LOGO} className="h-15 w-15 object-contain" /> : null}
          </a>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {menuItems.map(item => (
            <Link key={item.href} href={item.href}>
              <a
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
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

        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded bg-muted" />
          ) : isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.name || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="rounded-sm px-2 py-1.5 text-sm">
                  <p className="font-medium">{user.name || "Usu\u00e1rio"}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
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
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer gap-2">
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
        <div className="border-t bg-background md:hidden">
          <nav className="container flex flex-col gap-3 py-4">
            {menuItems.map(item => (
              <Link key={item.href} href={item.href}>
                <a
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
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
      ) : null}
    </header>
  );
}
