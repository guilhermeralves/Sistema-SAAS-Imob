import { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";

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
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
