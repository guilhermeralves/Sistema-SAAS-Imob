import { adminProcedure, router } from "./_core/trpc";

/**
 * Router de integrações externas. Cada integração ganha um sub-router
 * (botconversa, futuras: asaas, d4sign, etc.). Todas as chamadas são
 * adminProcedure — só administrativo pode operar/testar integrações.
 */
export const integracoesRouter = router({
  botconversa: router({
    /**
     * Lista contatos (subscribers) da conta BotConversa. Retorna também
     * a contagem para facilitar debug na UI.
     */
    listarContatos: adminProcedure.query(async () => {
      const { listSubscribers } = await import("./_core/botconversa");
      const contatos = await listSubscribers();
      return {
        total: contatos.length,
        contatos,
      };
    }),
  }),
});
