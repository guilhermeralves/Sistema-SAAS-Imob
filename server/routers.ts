import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============= PROPERTIES ROUTER =============
  properties: router({
    list: publicProcedure.query(async () => {
      const { getAllProperties } = await import("./db");
      return await getAllProperties();
    }),
    getById: publicProcedure.input((val: unknown) => {
      if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
        return val as { id: number };
      }
      throw new Error("Invalid input");
    }).query(async ({ input }) => {
      const { getPropertyById } = await import("./db");
      return await getPropertyById(input.id);
    }),
    getDestacados: publicProcedure.query(async () => {
      const { getDestacados } = await import("./db");
      return await getDestacados();
    }),
    myProperties: protectedProcedure.query(async ({ ctx }) => {
      const { getPropertiesByCorretor } = await import("./db");
      return await getPropertiesByCorretor(ctx.user.id);
    }),
    create: protectedProcedure.input((val: unknown) => val).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "corretor" && ctx.user.role !== "administrativo") {
        throw new Error("Apenas corretores e administradores podem criar imóveis");
      }
      const { createProperty } = await import("./db");
      return await createProperty({ ...input as any, idCorretor: ctx.user.id });
    }),
    update: protectedProcedure.input((val: unknown) => val).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input as any;
      const { getPropertyById, updateProperty } = await import("./db");
      const property = await getPropertyById(id);
      if (!property) throw new Error("Imóvel não encontrado");
      if (ctx.user.role === "corretor" && property.idCorretor !== ctx.user.id) {
        throw new Error("Você não tem permissão para editar este imóvel");
      }
      return await updateProperty(id, data);
    }),
    delete: protectedProcedure.input((val: unknown) => {
      if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
        return val as { id: number };
      }
      throw new Error("Invalid input");
    }).mutation(async ({ ctx, input }) => {
      const { getPropertyById, deleteProperty } = await import("./db");
      const property = await getPropertyById(input.id);
      if (!property) throw new Error("Imóvel não encontrado");
      if (ctx.user.role === "corretor" && property.idCorretor !== ctx.user.id) {
        throw new Error("Você não tem permissão para deletar este imóvel");
      }
      return await deleteProperty(input.id);
    }),
  }),

  // ============= LEADS ROUTER =============
  leads: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getAllLeads, getLeadsByResponsavel } = await import("./db");
      if (ctx.user.role === "administrativo") {
        return await getAllLeads();
      }
      return await getLeadsByResponsavel(ctx.user.id);
    }),
    getById: protectedProcedure.input((val: unknown) => {
      if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
        return val as { id: number };
      }
      throw new Error("Invalid input");
    }).query(async ({ input }) => {
      const { getLeadById } = await import("./db");
      return await getLeadById(input.id);
    }),
    create: publicProcedure.input((val: unknown) => val).mutation(async ({ input }) => {
      const { createLead } = await import("./db");
      return await createLead(input as any);
    }),
    update: protectedProcedure.input((val: unknown) => val).mutation(async ({ input }) => {
      const { id, ...data } = input as any;
      const { updateLead } = await import("./db");
      return await updateLead(id, data);
    }),
    delete: protectedProcedure.input((val: unknown) => {
      if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
        return val as { id: number };
      }
      throw new Error("Invalid input");
    }).mutation(async ({ input }) => {
      const { deleteLead } = await import("./db");
      return await deleteLead(input.id);
    }),
    getNotes: protectedProcedure.input((val: unknown) => {
      if (typeof val === "object" && val !== null && "idLead" in val && typeof val.idLead === "number") {
        return val as { idLead: number };
      }
      throw new Error("Invalid input");
    }).query(async ({ input }) => {
      const { getLeadNotes } = await import("./db");
      return await getLeadNotes(input.idLead);
    }),
    addNote: protectedProcedure.input((val: unknown) => val).mutation(async ({ ctx, input }) => {
      const { createLeadNote } = await import("./db");
      return await createLeadNote({ ...input as any, idUsuario: ctx.user.id });
    }),
    getFiles: protectedProcedure.input((val: unknown) => {
      if (typeof val === "object" && val !== null && "idLead" in val && typeof val.idLead === "number") {
        return val as { idLead: number };
      }
      throw new Error("Invalid input");
    }).query(async ({ input }) => {
      const { getLeadFiles } = await import("./db");
      return await getLeadFiles(input.idLead);
    }),
    addFile: protectedProcedure.input((val: unknown) => val).mutation(async ({ ctx, input }) => {
      const { createLeadFile } = await import("./db");
      return await createLeadFile({ ...input as any, idUsuario: ctx.user.id });
    }),
  }),

  // ============= CONTRACTS ROUTER =============
  contracts: router({
    myContracts: protectedProcedure.query(async ({ ctx }) => {
      const { getContractsByCliente } = await import("./db");
      return await getContractsByCliente(ctx.user.id);
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "administrativo") {
        throw new Error("Apenas administradores podem listar todos os contratos");
      }
      const { getAllContracts } = await import("./db");
      return await getAllContracts();
    }),
    create: protectedProcedure.input((val: unknown) => val).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "administrativo") {
        throw new Error("Apenas administradores podem criar contratos");
      }
      const { createContract } = await import("./db");
      return await createContract(input as any);
    }),
  }),

  // ============= DOCUMENTS ROUTER =============
  documents: router({
    myDocuments: protectedProcedure.query(async ({ ctx }) => {
      const { getDocumentsByUsuario } = await import("./db");
      return await getDocumentsByUsuario(ctx.user.id);
    }),
    create: protectedProcedure.input((val: unknown) => val).mutation(async ({ ctx, input }) => {
      const { createDocument } = await import("./db");
      return await createDocument({ ...input as any, idUsuario: ctx.user.id });
    }),
    updateStatus: protectedProcedure.input((val: unknown) => val).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "administrativo") {
        throw new Error("Apenas administradores podem atualizar status de documentos");
      }
      const { id, status } = input as any;
      const { updateDocument } = await import("./db");
      return await updateDocument(id, { status });
    }),
  }),

  // ============= ADMIN ROUTER =============
  admin: router({
    users: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "administrativo") {
        throw new Error("Apenas administradores podem listar usuários");
      }
      const { getAllUsers } = await import("./db");
      return await getAllUsers();
    }),
    updateUserRole: protectedProcedure.input((val: unknown) => val).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "administrativo") {
        throw new Error("Apenas administradores podem atualizar roles");
      }
      const { id, role } = input as any;
      const { updateUserRole } = await import("./db");
      return await updateUserRole(id, role);
    }),
  }),
});

export type AppRouter = typeof appRouter;
