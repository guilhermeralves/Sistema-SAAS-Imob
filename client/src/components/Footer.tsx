import { Link } from "wouter";
import { APP_TITLE, APP_LOGO2 } from "@/const";
import { Mail, Phone, MapPin, Facebook, Instagram, Linkedin } from "lucide-react";

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
  phone: "(11) 9999-9999",
  email: "contato@afgimobiliaria.com.br",
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
    <footer className="bg-muted/50 border-t mt-auto">
      <div className="container py-12">
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
                href={`tel:${CONTACT_INFO.phone.replace(/\D/g, "")}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4" />
                {CONTACT_INFO.phone}
              </a>
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

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>
            © {currentYear} {APP_TITLE}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
