import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";

/**
 * Router de integrações externas. Cada integração ganha um sub-router
 * (botconversa, futuras: asaas, d4sign, etc.). Todas as chamadas são
 * adminProcedure — só administrativo pode operar/testar integrações.
 */
export const integracoesRouter = router({
  botconversa: router({
    /**
     * Lista contatos em lotes de 500 (default). Cliente passa
     * `startPage` (número da página BotConversa por onde começar). No
     * retorno vem `nextStartPage` — usar isso no próximo clique de
     * "Próxima". Se for null, chegou ao fim.
     */
    listarContatos: adminProcedure
      .input(
        z
          .object({
            startPage: z.number().int().min(1).default(1),
            chunkSize: z.number().int().min(1).max(2000).default(500),
          })
          .default({ startPage: 1, chunkSize: 500 })
      )
      .query(async ({ input }) => {
        const { listSubscribersChunk } = await import("./_core/botconversa");
        const chunk = await listSubscribersChunk({
          startPage: input.startPage,
          chunkSize: input.chunkSize,
        });
        return {
          startPage: input.startPage,
          chunkSize: input.chunkSize,
          total: chunk.count,
          contatos: chunk.contatos,
          nextStartPage: chunk.nextStartPage,
        };
      }),
  }),
});
