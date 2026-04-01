import { Link } from "wouter";
import { APP_LOGO2, APP_TITLE, APP_VERSION } from "@/const";
import { Mail, MapPin, Facebook, Instagram, Linkedin } from "lucide-react";

/**
 * Footer Component
 * 
 * Rodapé do site com informações de contato e links úteis.
 * 
 * EDIÇÃO:
 * - Para alterar informações de contato: edite as constantes abaixo
 * - Para adicionar/remover redes sociais: edite socialLinks
 * - Para modificar links rápidos: edite quickLinks
 */

// ========== ÁREA DE EDIÇÃO - INFORMAÇÕES DE CONTATO ==========
const CONTACT_INFO = {
  email: "contato@afg.com",
  address: "Av. Cassiano Ricardo, 601 The One Office Tower - Jardim Aquarius - São José dos Campos/SP",
  whatsapp: "5511999999999", // Formato: código do país + DDD + número
};

const socialLinks = [
  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
];

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/imoveis", label: "Imóveis" },
  { href: "/servicos", label: "Serviços" },
  { href: "/contato", label: "Contato" },
];
// ========== FIM DA ÁREA DE EDIÇÃO ==========

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto overflow-hidden border-t bg-muted/50">
      <div className="container pb-10 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sobre a Empresa */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={APP_LOGO2} className="h-28 w-28 text-primary" />
              {/*<h3 className="text-lg font-bold">{APP_TITLE}</h3>*/}
            </div>
            <p className="text-sm text-muted-foreground">
              Sua imobiliária de confiança. Facilitamos a compra, venda e locação de imóveis com
              tecnologia e atendimento personalizado.
            </p>
            {/* Redes Sociais */}
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-full bg-background border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Rápidos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Links Rápidos</h3>
            <nav className="flex flex-col gap-2">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <a className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {link.label}
                  </a>
                </Link>
              ))}
            </nav>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contato</h3>
            <div className="space-y-3">
              <a
                href={`mailto:${CONTACT_INFO.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4" />
                {CONTACT_INFO.email}
              </a>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{CONTACT_INFO.address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="relative w-full border-t border-slate-500/45 bg-[linear-gradient(135deg,#474c54,#585e68_45%,#707988)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.2)_0px,rgba(255,255,255,0.2)_1px,transparent_1px,transparent_8px)]"
        />
        <div className="container py-5 text-center text-sm text-slate-100">
          <p className="text-slate-50">
            © {currentYear} {APP_TITLE} - Todos os direitos reservados.
          </p>
          <p className="mt-2 text-slate-50">
            <span className="font-bold text-slate-50">CNPJ</span> 12.345.678/0001-99 / <span className="font-bold text-slate-50">CRECI/SP</span> J-56842 
          </p>
          <p className="mt-4 text-slate-50">
            Created by <span className="font-bold text-slate-50">Noxilon®</span> 
          </p>
          <p className="text-slate-200">Software Version {APP_VERSION}</p>
        </div>
      </div>
    </footer>
  );
}
