import { APP_ROLES } from "@shared/auth";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { hashPassword, verifyPassword } from "./_core/passwords";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  clientProcedure,
  publicProcedure,
  router,
  staffProcedure,
} from "./_core/trpc";
import { toSafeUser, toSafeUsers } from "./_core/users";

const idSchema = z.object({
  id: z.number().int().positive(),
});

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

const adminCreateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["corretor", "administrativo"]),
});

const adminUpdateUserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(APP_ROLES).optional(),
  password: z.string().min(8).max(72).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});

const assignLeadSchema = z.object({
  leadId: z.number().int().positive(),
  userId: z.number().int().positive().nullable(),
});

function setSessionCookie(ctx: { req: any; res: any }, sessionToken: string) {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, sessionToken, {
    ...cookieOptions,
    maxAge: ONE_YEAR_MS,
  });
}

async function ensurePropertyExists(id: number) {
  const { getPropertyById } = await import("./db");
  const property = await getPropertyById(id);

  if (!property) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Imóvel não encontrado" });
  }

  return property;
}

async function ensureLeadAccess(
  user: { id: number; role: "cliente" | "corretor" | "administrativo" },
  leadId: number
) {
  const { getLeadById } = await import("./db");
  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
  }

  if (user.role === "corretor" && lead.idResponsavel !== user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem acesso a este lead" });
  }

  return lead;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    register: publicProcedure.input(registerSchema).mutation(async ({ ctx, input }) => {
      const { createUser, getUserByEmail } = await import("./db");
      const existingUser = await getUserByEmail(input.email);

      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado" });
      }

      const passwordHash = await hashPassword(input.password);
      const createdUser = await createUser({
        openId: `local:${nanoid()}`,
        name: input.name?.trim() || null,
        email: input.email,
        loginMethod: "password",
        passwordHash,
        role: "cliente",
        isActive: 1,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(createdUser.openId, {
        name: createdUser.name || createdUser.email || createdUser.openId,
        provider: "local",
        userId: createdUser.id,
      });

      setSessionCookie(ctx, sessionToken);

      return toSafeUser(createdUser);
    }),
    login: publicProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
      const { getUserByEmail, upsertUser } = await import("./db");
      const user = await getUserByEmail(input.email);

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos" });
      }

      if (user.isActive !== 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário desativado" });
      }

      const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos" });
      }

      await upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.email || user.openId,
        provider: "local",
        userId: user.id,
      });

      setSessionCookie(ctx, sessionToken);

      return toSafeUser(user);
    }),
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  properties: router({
    list: publicProcedure.query(async () => {
      const { getAllProperties } = await import("./db");
      return await getAllProperties();
    }),
    getById: publicProcedure.input(idSchema).query(async ({ input }) => {
      const { getPropertyById } = await import("./db");
      return await getPropertyById(input.id);
    }),
    getDestacados: publicProcedure.query(async () => {
      const { getDestacados } = await import("./db");
      return await getDestacados();
    }),
    myProperties: staffProcedure.query(async ({ ctx }) => {
      const { getAllProperties, getPropertiesByCorretor } = await import("./db");
      if (ctx.user.role === "administrativo") {
        return await getAllProperties();
      }
      return await getPropertiesByCorretor(ctx.user.id);
    }),
    create: staffProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createProperty } = await import("./db");
      const payload = { ...(input as any) };

      payload.idCorretor =
        ctx.user.role === "administrativo" && typeof payload.idCorretor === "number"
          ? payload.idCorretor
          : ctx.user.id;

      return await createProperty(payload);
    }),
    update: staffProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { updateProperty } = await import("./db");
      const { id, ...data } = input as any;
      const property = await ensurePropertyExists(id);

      if (ctx.user.role === "corretor" && property.idCorretor !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para editar este imóvel" });
      }

      if (ctx.user.role === "corretor") {
        data.idCorretor = ctx.user.id;
      }

      return await updateProperty(id, data);
    }),
    delete: adminProcedure.input(idSchema).mutation(async ({ input }) => {
      const { deleteProperty } = await import("./db");
      await ensurePropertyExists(input.id);
      return await deleteProperty(input.id);
    }),
  }),

  leads: router({
    list: staffProcedure.query(async ({ ctx }) => {
      const { getAllLeads, getLeadsByResponsavel } = await import("./db");
      if (ctx.user.role === "administrativo") {
        return await getAllLeads();
      }
      return await getLeadsByResponsavel(ctx.user.id);
    }),
    getById: staffProcedure.input(idSchema).query(async ({ ctx, input }) => {
      return await ensureLeadAccess(ctx.user, input.id);
    }),
    create: publicProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createLead } = await import("./db");
      const payload = { ...(input as any) };

      if (ctx.user && (ctx.user.role === "corretor" || ctx.user.role === "administrativo")) {
        payload.idResponsavel = ctx.user.id;
      } else {
        delete payload.idResponsavel;
      }

      return await createLead(payload);
    }),
    update: staffProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { updateLead } = await import("./db");
      const { id, ...data } = input as any;
      await ensureLeadAccess(ctx.user, id);

      if (ctx.user.role !== "administrativo") {
        delete data.idResponsavel;
      }

      return await updateLead(id, data);
    }),
    assign: adminProcedure.input(assignLeadSchema).mutation(async ({ input }) => {
      const { getUserById, updateLead } = await import("./db");
      await ensureLeadAccess({ id: 0, role: "administrativo" }, input.leadId);

      if (input.userId !== null) {
        const assignedUser = await getUserById(input.userId);
        if (!assignedUser || assignedUser.role !== "corretor" || assignedUser.isActive !== 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um corretor ativo" });
        }
      }

      return await updateLead(input.leadId, { idResponsavel: input.userId });
    }),
    delete: adminProcedure.input(idSchema).mutation(async ({ input }) => {
      const { deleteLead } = await import("./db");
      await ensureLeadAccess({ id: 0, role: "administrativo" }, input.id);
      return await deleteLead(input.id);
    }),
    getNotes: staffProcedure
      .input(z.object({ idLead: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { getLeadNotes } = await import("./db");
        await ensureLeadAccess(ctx.user, input.idLead);
        return await getLeadNotes(input.idLead);
      }),
    addNote: staffProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createLeadNote } = await import("./db");
      await ensureLeadAccess(ctx.user, (input as any).idLead);
      return await createLeadNote({ ...(input as any), idUsuario: ctx.user.id });
    }),
    getFiles: staffProcedure
      .input(z.object({ idLead: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { getLeadFiles } = await import("./db");
        await ensureLeadAccess(ctx.user, input.idLead);
        return await getLeadFiles(input.idLead);
      }),
    addFile: staffProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createLeadFile } = await import("./db");
      await ensureLeadAccess(ctx.user, (input as any).idLead);
      return await createLeadFile({ ...(input as any), idUsuario: ctx.user.id });
    }),
  }),

  contracts: router({
    myContracts: clientProcedure.query(async ({ ctx }) => {
      const { getContractsByCliente } = await import("./db");
      return await getContractsByCliente(ctx.user.id);
    }),
    list: adminProcedure.query(async () => {
      const { getAllContracts } = await import("./db");
      return await getAllContracts();
    }),
    create: adminProcedure.input(z.any()).mutation(async ({ input }) => {
      const { createContract } = await import("./db");
      return await createContract(input as any);
    }),
  }),

  documents: router({
    myDocuments: clientProcedure.query(async ({ ctx }) => {
      const { getDocumentsByUsuario } = await import("./db");
      return await getDocumentsByUsuario(ctx.user.id);
    }),
    create: clientProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const { createDocument } = await import("./db");
      return await createDocument({ ...(input as any), idUsuario: ctx.user.id });
    }),
    updateStatus: adminProcedure.input(z.any()).mutation(async ({ input }) => {
      const { id, status } = input as any;
      const { updateDocument } = await import("./db");
      return await updateDocument(id, { status });
    }),
  }),

  admin: router({
    users: adminProcedure.query(async () => {
      const { getAllUsers } = await import("./db");
      return toSafeUsers(await getAllUsers());
    }),
    createUser: adminProcedure.input(adminCreateUserSchema).mutation(async ({ input }) => {
      const { createUser, getUserByEmail } = await import("./db");
      const existingUser = await getUserByEmail(input.email);

      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado" });
      }

      const passwordHash = await hashPassword(input.password);
      const createdUser = await createUser({
        openId: `local:${nanoid()}`,
        name: input.name?.trim() || null,
        email: input.email,
        loginMethod: "password",
        passwordHash,
        role: input.role,
        isActive: 1,
      });

      return toSafeUser(createdUser);
    }),
    updateUser: adminProcedure.input(adminUpdateUserSchema).mutation(async ({ ctx, input }) => {
      const { getUserById, updateUser } = await import("./db");
      const targetUser = await getUserById(input.id);

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      }

      if (ctx.user.id === targetUser.id && input.isActive === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode desativar sua própria conta" });
      }

      const updatePayload: Record<string, unknown> = {};

      if (input.name !== undefined) {
        updatePayload.name = input.name.trim();
      }
      if (input.role !== undefined) {
        updatePayload.role = input.role;
      }
      if (input.isActive !== undefined) {
        updatePayload.isActive = input.isActive;
      }
      if (input.password) {
        updatePayload.passwordHash = await hashPassword(input.password);
        updatePayload.loginMethod = "password";
      }

      await updateUser(input.id, updatePayload);

      const updatedUser = await getUserById(input.id);
      if (!updatedUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      }

      return toSafeUser(updatedUser);
    }),
    updateUserRole: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          role: z.enum(APP_ROLES),
        })
      )
      .mutation(async ({ input }) => {
        const { updateUserRole } = await import("./db");
        return await updateUserRole(input.id, input.role);
      }),
  }),
});

export type AppRouter = typeof appRouter;
