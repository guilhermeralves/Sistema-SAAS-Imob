import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import * as db from "../db";
import { ENV } from "./env";
import type {
  AuthorizeRequest,
  AuthorizeResponse,
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/oauthTypes";
import type { SafeUser } from "./users";
import { toSafeUser } from "./users";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  subject: string;
  appId: string;
  name?: string;
  provider?: "local" | "oauth";
  userId?: number;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const AUTHORIZE_PATH = `/webdev.v1.WebDevAuthPublicService/Authorize`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH =
  `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {}

  private decodeState(state: string): string {
    return atob(state);
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  async getAuthorizeUrl(redirectUri: string, state: string): Promise<string> {
    const payload: AuthorizeRequest = {
      redirectUri,
      projectId: ENV.appId,
      state,
      responseType: "code",
      scope: "openid profile email",
    };

    const { data } = await this.client.post<AuthorizeResponse>(AUTHORIZE_PATH, payload);
    return data.redirectUrl;
  }

  async getUserInfoByToken(
    token: ExchangeTokenResponse
  ): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((platform): platform is string => typeof platform === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    ) {
      return "microsoft";
    }
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  async getAuthorizeUrl(redirectUri: string): Promise<string> {
    const encodedState = Buffer.from(redirectUri).toString("base64");
    return this.oauthService.getAuthorizeUrl(redirectUri, encodedState);
  }

  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    subject: string,
    options: {
      expiresInMs?: number;
      name?: string;
      provider?: "local" | "oauth";
      userId?: number;
    } = {}
  ): Promise<string> {
    return this.signSession(
      {
        subject,
        appId: ENV.appId,
        name: options.name || "",
        provider: options.provider ?? "oauth",
        userId: options.userId,
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT({
      openId: payload.subject,
      subject: payload.subject,
      appId: payload.appId,
      name: payload.name ?? "",
      provider: payload.provider ?? "oauth",
      userId: payload.userId,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{
    subject: string;
    appId: string;
    name: string;
    provider: "local" | "oauth";
    userId?: number;
  } | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const {
        subject,
        openId,
        appId,
        name,
        provider,
        userId,
      } = payload as Record<string, unknown>;

      const resolvedSubject =
        (typeof subject === "string" && subject.length > 0 ? subject : null) ??
        (typeof openId === "string" && openId.length > 0 ? openId : null);

      if (!isNonEmptyString(resolvedSubject) || !isNonEmptyString(appId)) {
        return null;
      }

      return {
        subject: resolvedSubject,
        appId,
        name: typeof name === "string" ? name : "",
        provider: provider === "local" ? "local" : "oauth",
        userId: typeof userId === "number" ? userId : undefined,
      };
    } catch {
      return null;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  async authenticateRequest(req: Request): Promise<SafeUser> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const signedInAt = new Date();
    let user =
      session.userId !== undefined
        ? await db.getUserById(session.userId)
        : await db.getUserByOpenId(session.subject);

    if (session.provider === "local") {
      if (!user || user.isActive !== 1) {
        throw ForbiddenError("User not found");
      }

      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: signedInAt,
      });

      return toSafeUser(user);
    }

    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          registrationSource: "oauth",
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user || user.isActive !== 1) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return toSafeUser(user);
  }
}

export const sdk = new SDKServer();
