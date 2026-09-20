type EmailLayoutInput = {
  title: string;
  preheader: string;
  greeting: string;
  intro: string;
  highlights: string[];
  ctaLabel: string;
  ctaUrl: string;
  footerText: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailLayout(input: EmailLayoutInput) {
  const highlightsHtml = input.highlights
    .map(item => `<li style="margin: 0 0 8px; color: #334155;">${escapeHtml(item)}</li>`)
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin: 0; padding: 24px; background: #f3f6fb; font-family: Georgia, 'Times New Roman', serif; color: #0f172a;">
    <div style="display: none; max-height: 0; overflow: hidden;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; border-collapse: collapse;">
      <tr>
        <td style="padding: 0;">
          <div style="background: linear-gradient(135deg, #0f4c81 0%, #1d8ab5 100%); color: #ffffff; border-radius: 20px 20px 0 0; padding: 28px 32px;">
            <p style="margin: 0 0 10px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.78;">New Imobiliária</p>
            <h1 style="margin: 0; font-size: 30px; line-height: 1.15;">${escapeHtml(input.title)}</h1>
          </div>
          <div style="background: #ffffff; border: 1px solid #dbe4f0; border-top: 0; border-radius: 0 0 20px 20px; padding: 32px;">
            <p style="margin: 0 0 16px; font-size: 18px; line-height: 1.5;">${escapeHtml(input.greeting)}</p>
            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.65; color: #334155;">${escapeHtml(input.intro)}</p>
            <ul style="margin: 0 0 28px; padding-left: 20px; font-size: 15px; line-height: 1.6;">
              ${highlightsHtml}
            </ul>
            <p style="margin: 0 0 30px;">
              <a href="${escapeHtml(input.ctaUrl)}" style="display: inline-block; background: #0f4c81; color: #ffffff; text-decoration: none; border-radius: 999px; padding: 14px 24px; font-size: 15px; font-weight: 600;">
                ${escapeHtml(input.ctaLabel)}
              </a>
            </p>
            <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #64748b;">${escapeHtml(input.footerText)}</p>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    input.title,
    "",
    input.greeting,
    "",
    input.intro,
    "",
    ...input.highlights.map(item => `- ${item}`),
    "",
    `${input.ctaLabel}: ${input.ctaUrl}`,
    "",
    input.footerText,
  ].join("\n");

  return { html, text };
}
