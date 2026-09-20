import { renderEmailLayout } from "./base";

type WelcomeClientTemplateInput = {
  name: string;
  appUrl: string;
};

export function renderWelcomeClientTemplate(input: WelcomeClientTemplateInput) {
  return renderEmailLayout({
    title: "Bem-vindo(a) a New Imobiliária",
    preheader: "Seu acesso ao portal da New foi criado com sucesso.",
    greeting: `Ola, ${input.name}!`,
    intro: "Seu cadastro no portal da New Imobiliária foi concluido com sucesso. A partir de agora voce ja pode acessar sua conta e acompanhar as proximas etapas com mais facilidade.",
    highlights: [
      "Use o mesmo e-mail informado no cadastro para entrar no portal.",
      "Mantenha seus dados pessoais e de contato sempre atualizados.",
      "Se houver interesse comercial anterior, nosso time podera continuar o atendimento com o mesmo historico.",
    ],
    ctaLabel: "Acessar portal",
    ctaUrl: input.appUrl,
    footerText: "Se voce nao reconhece este cadastro, responda a este e-mail ou entre em contato com a equipe da New Imobiliária.",
  });
}
