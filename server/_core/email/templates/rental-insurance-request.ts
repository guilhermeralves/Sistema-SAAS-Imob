import { renderEmailLayout } from "./base";

type RentalInsuranceRequestTemplateInput = {
  name: string;
  propertyLabel: string;
  referenceCode: string | null;
  appUrl: string;
};

export function renderRentalInsuranceRequestTemplate(
  input: RentalInsuranceRequestTemplateInput
) {
  const referenceLine = input.referenceCode
    ? `Locacao de referencia ${input.referenceCode}.`
    : "";

  return renderEmailLayout({
    title: "Comprovantes dos seguros da sua locacao",
    preheader:
      "Envie os comprovantes das primeiras parcelas do seguro fianca e do seguro incendio.",
    greeting: `Ola, ${input.name}!`,
    intro: `Para prosseguir com a sua locacao do imovel ${input.propertyLabel}, precisamos dos comprovantes de pagamento das primeiras parcelas do seguro fianca e do seguro incendio. ${referenceLine}`.trim(),
    highlights: [
      "Seguro fianca: comprovante da primeira parcela paga.",
      "Seguro incendio: comprovante da primeira parcela paga.",
      "Voce pode responder a este e-mail anexando os comprovantes ou envia-los pelo WhatsApp da AFG.",
    ],
    ctaLabel: "Falar com a AFG",
    ctaUrl: input.appUrl,
    footerText:
      "Assim que recebermos e validarmos os comprovantes, avancamos para as proximas etapas da locacao.",
  });
}
