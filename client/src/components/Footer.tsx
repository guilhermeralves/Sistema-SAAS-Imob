import { Link } from "wouter";
import { APP_LOGO2, APP_LOGO_WHITE, APP_TITLE, APP_VERSION } from "@/const";
import { formatFullAddress, useSystemInfo } from "@/hooks/useSystemInfo";
import { Mail, MapPin, Facebook, Instagram, Linkedin, Phone } from "lucide-react";

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

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const info = useSystemInfo();

  const nome = info?.nomeFantasia || APP_TITLE;
  const email = info?.email || "";
  const telefone = info?.telefone || "";
  const endereco = info ? formatFullAddress(info) : "";
  const cnpj = info?.cnpj || "";
  const creciPj = info?.creciPj || "";

  return (
    <footer className="mt-auto overflow-hidden border-t bg-muted/50">
      <div className="container pb-10 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sobre a Empresa */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {/* Logo preta para modo claro */}
              <img
                src={APP_LOGO2}
                alt="New Imob"
                className="h-24 w-auto object-contain md:h-28 dark:hidden [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.25))_drop-shadow(0_3px_5px_rgba(0,0,0,0.12))]"
              />
              {/* Logo branca para modo escuro */}
              <img
                src={APP_LOGO_WHITE}
                alt="New Imob"
                className="hidden h-24 w-auto object-contain md:h-28 dark:block [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.4))_drop-shadow(0_3px_6px_rgba(255,255,255,0.1))]"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {nome
                ? `${nome} — sua imobiliária de confiança. Facilitamos a compra, venda e locação de imóveis com tecnologia e atendimento personalizado.`
                : "Sua imobiliária de confiança."}
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
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  {email}
                </a>
              ) : null}
              {telefone ? (
                <a
                  href={`tel:${telefone.replace(/\D/g, "")}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  {telefone}
                </a>
              ) : null}
              {endereco ? (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{endereco}</span>
                </div>
              ) : null}
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
            © {currentYear} {nome} - Todos os direitos reservados.
          </p>
          {(cnpj || creciPj) ? (
            <p className="mt-2 text-slate-50">
              {cnpj ? (
                <>
                  <span className="font-bold text-slate-50">CNPJ</span> {cnpj}
                </>
              ) : null}
              {cnpj && creciPj ? " / " : ""}
              {creciPj ? (
                <>
                  <span className="font-bold text-slate-50">CRECI-PJ</span> {creciPj}
                </>
              ) : null}
            </p>
          ) : null}
          <p className="mt-4 text-slate-50">
            Created by <span className="font-bold text-slate-50">Noxilon®</span>
          </p>
          <p className="text-slate-200">Software Version {APP_VERSION}</p>
        </div>
      </div>
    </footer>
  );
}
