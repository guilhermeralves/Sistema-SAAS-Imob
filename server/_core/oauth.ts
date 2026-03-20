import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getPostAuthRedirectPath(role: string | null | undefined) {
  if (role === "administrativo" || role === "corretor") {
    return "/dashboard";
  }

  return "/";
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/google", async (req: Request, res: Response) => {
    try {
      const callbackUrl = new URL("/api/oauth/callback", `${req.protocol}://${req.get("host")}`).toString();
      const authorizeUrl = await sdk.getAuthorizeUrl(callbackUrl);
      res.redirect(302, authorizeUrl);
    } catch (error) {
      console.error("[OAuth] Failed to start Google login", error);
      res.redirect(302, "/login?oauth_error=google_start_failed");
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        registrationSource: "oauth",
        lastSignedIn: new Date(),
      });

      const syncedUser = await db.getUserByOpenId(userInfo.openId);

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
        provider: "oauth",
        userId: syncedUser?.id,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, getPostAuthRedirectPath(syncedUser?.role));
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.redirect(302, "/login?oauth_error=google_callback_failed");
    }
  });
}
