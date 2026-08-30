import { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import Header from "./Header";
import Footer from "./Footer";
import { toWhatsappDigits, useSystemInfo } from "@/hooks/useSystemInfo";
import { cn } from "@/lib/utils";

/**
 * Layout Component
 * 
 * Layout principal do site que envolve todas as páginas com Header e Footer.
 * 
 * EDIÇÃO:
 * - Este componente geralmente não precisa ser editado
 * - Para modificar o header: edite client/src/components/Header.tsx
 * - Para modificar o footer: edite client/src/components/Footer.tsx
 */

interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
  mainClassName?: string;
}

export default function Layout({ children, hideFooter = false, mainClassName }: LayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const hideWhatsappShortcut = location === "/login" || location === "/register";
  const info = useSystemInfo();
  const whatsappDigits = toWhatsappDigits(info?.telefone);
  const shouldShowWhatsappShortcut =
    !hideWhatsappShortcut &&
    Boolean(whatsappDigits) &&
    (!isAuthenticated || user?.role === "cliente");
  const whatsappHref =
    `https://wa.me/${whatsappDigits}?text=` +
    encodeURIComponent("Olá! Gostaria de mais informações.");

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className={cn("min-h-0 flex-1", mainClassName)}>{children}</main>
      {!hideFooter ? <Footer /> : null}
      {shouldShowWhatsappShortcut ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Conversar no WhatsApp"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_20px_45px_-20px_rgba(37,211,102,0.85)] transition-transform duration-200 hover:scale-105 hover:bg-[#1fb85a] md:bottom-6 md:right-6"
        >
          <img
            src="/Images/whatsapp-white-icon.svg"
            alt="WhatsApp"
            className="h-7 w-7"
          />
        </a>
      ) : null}
    </div>
  );
}
