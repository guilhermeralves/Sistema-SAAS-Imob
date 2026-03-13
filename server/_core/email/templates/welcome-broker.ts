import { renderEmailLayout } from "./base";

type WelcomeBrokerTemplateInput = {
  name: string;
  appUrl: string;
};

export function renderWelcomeBrokerTemplate(input: WelcomeBrokerTemplateInput) {
  return renderEmailLayout({
    title: "Seu acesso de corretor foi criado",
    preheader: "A conta de corretor da AFG esta pronta para uso.",
    greeting: `Ola, ${input.name}!`,
    intro: "Seu acesso como corretor foi liberado na plataforma da AFG Imobiliaria. Antes de operar, revise seus dados e confirme se o cadastro do CRECI esta correto no seu perfil.",
    highlights: [
      "Revise seus dados cadastrais no primeiro acesso.",
      "Se o CRECI foi cadastrado pelo admin, ele ja pode aparecer como validado.",
      "Se o CRECI foi informado pelo proprio corretor, o status pode ficar pendente ate validacao administrativa.",
    ],
    ctaLabel: "Entrar na plataforma",
    ctaUrl: input.appUrl,
    footerText: "Em caso de duvida sobre credenciais, permissao de acesso ou validacao do CRECI, responda este e-mail e fale com a administracao da AFG.",
  });
}
