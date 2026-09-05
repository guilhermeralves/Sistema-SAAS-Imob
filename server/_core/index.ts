import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import os from 'os';
import fs from "fs/promises";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { ensureBootstrapAdmin } from "./bootstrapAdmin";
import { createContext } from "./context";
import {
  ensurePropertyUploadDir,
  getPropertyImageAbsolutePath,
  PROPERTY_IMAGE_REQUEST_HEADER,
  type PropertyImageVariant,
} from "./property-images";
import {
  ensureLaunchUploadDir,
  getLaunchImageAbsolutePath,
} from "./launch-images";
import {
  ensureLaunchFilesUploadDir,
  getLaunchFileAbsolutePath,
} from "./launch-files";
import { startLeadSlaScheduler } from "./leadSla";
import { startLicenseHeartbeat } from "./licenseHeartbeat";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  await ensureBootstrapAdmin();
  await ensurePropertyUploadDir();
  await ensureLaunchUploadDir();
  await ensureLaunchFilesUploadDir();
  startLeadSlaScheduler();
  startLicenseHeartbeat();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads.
  // 100 MB comporta PDF de até ~70 MB (base64 = ~1.33x do tamanho).
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  const sendPropertyImage = async (
    req: express.Request,
    res: express.Response,
    variant: PropertyImageVariant,
    fileName: string
  ) => {
    const mediaIntent = req.header(PROPERTY_IMAGE_REQUEST_HEADER) === "1";

    if (!mediaIntent) {
      res.status(404).end();
      return;
    }

    const absolutePath = getPropertyImageAbsolutePath(fileName, variant);

    if (!absolutePath) {
      res.status(404).end();
      return;
    }

    try {
      await fs.access(absolutePath);
    } catch {
      res.status(404).end();
      return;
    }

    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Robots-Tag", "noindex, noimageindex, noarchive");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

    res.sendFile(absolutePath, error => {
      if (error && !res.headersSent) {
        res.status(404).end();
      }
    });
  };

  app.get("/api/media/properties/:variant(large|thumb)/:fileName", async (req, res) => {
    await sendPropertyImage(
      req,
      res,
      req.params.variant as PropertyImageVariant,
      String(req.params.fileName || "").trim()
    );
  });

  app.get("/api/media/properties/:fileName", async (req, res) => {
    await sendPropertyImage(req, res, "large", String(req.params.fileName || "").trim());
  });

  // Fotos de lançamentos são PÚBLICAS (não exigem header/auth)
  app.get("/api/media/launches/:fileName", async (req, res) => {
    const fileName = String(req.params.fileName || "").trim();
    const abs = getLaunchImageAbsolutePath(fileName);
    if (!abs) {
      res.status(404).end();
      return;
    }
    try {
      await fs.access(abs);
    } catch {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(abs, error => {
      if (error && !res.headersSent) res.status(404).end();
    });
  });

  // Arquivos anexados a lançamentos (PDF/imagem/etc.) — públicos
  app.get("/api/media/launch-files/:fileName", async (req, res) => {
    const fileName = String(req.params.fileName || "").trim();
    const abs = getLaunchFileAbsolutePath(fileName);
    if (!abs) {
      res.status(404).end();
      return;
    }
    try {
      await fs.access(abs);
    } catch {
      res.status(404).end();
      return;
    }
    // Deixa o browser inferir o tipo pelo Content-Type do arquivo
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(abs, error => {
      if (error && !res.headersSent) res.status(404).end();
    });
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Webhook da D4Sign (assinaturas de locacao). A D4Sign envia o uuid do
  // documento quando o status muda; sincronizamos a assinatura correspondente.
  // Respondemos sempre 200 para evitar reenfileiramento do lado deles.
  app.post("/api/integrations/d4sign/webhook", async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const uuid = String(
        body.uuid ?? body.uuidDoc ?? req.query.uuid ?? ""
      ).trim();
      if (uuid) {
        const { handleD4SignSignatureCallback } = await import("../routers");
        await handleD4SignSignatureCallback(uuid);
      }
    } catch (error) {
      console.warn("[d4sign] Falha ao processar webhook:", error);
    }
    res.status(200).json({ ok: true });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, '0.0.0.0', () => {
    // Pegar o IP local da máquina
    const networkInterfaces = os.networkInterfaces();
    let localIP = 'localhost';
    
    // Procurar pelo IP da rede local (192.168.x.x ou 10.x.x.x)
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        for (const iface of interfaces) {
          // IPv4 e não é localhost
          if (iface.family === 'IPv4' && !iface.internal) {
            localIP = iface.address;
            break;
          }
        }
      }
    }
  
    console.log('\n🚀 Servidor iniciado com sucesso!\n');
    console.log(`📍 Acesso Local (Computador):`);
    console.log(`   http://localhost:${port}/` );
    console.log(`\n📱 Acesso Remoto (Celular/Tablet):`);
    console.log(`   http://${localIP}:${port}/` );
    console.log(`\n⚠️  Certifique-se de que o celular está na mesma rede Wi-Fi\n`);
  });
  
}

startServer().catch(console.error);
