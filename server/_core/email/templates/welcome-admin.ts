import { renderEmailLayout } from "./base";

type WelcomeAdminTemplateInput = {
  name: string;
  appUrl: string;
};

export function renderWelcomeAdminTemplate(input: WelcomeAdminTemplateInput) {
  return renderEmailLayout({
    title: "Seu acesso administrativo foi criado",
    preheader: "Uma nova conta administrativa da AFG foi provisionada para voce.",
    greeting: `Ola, ${input.name}!`,
    intro: "Sua conta administrativa na plataforma da AFG Imobiliaria foi criada. Esse perfil possui maior nivel de acesso, entao recomendamos revisar suas credenciais e boas praticas de seguranca no primeiro login.",
    highlights: [
      "Acesse o sistema com o e-mail cadastrado.",
      "Evite compartilhar credenciais com outros usuarios.",
      "Revise os dados do seu perfil logo no primeiro acesso.",
    ],
    ctaLabel: "Acessar painel",
    ctaUrl: input.appUrl,
    footerText: "Se este acesso nao deveria existir ou voce precisar de suporte, responda este e-mail imediatamente para a equipe responsavel da AFG.",
  });
}
