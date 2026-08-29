import {
  BadRequestException,
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseClient } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import type { Environment } from "../config/environment.js";
import { EmailOtpDeliveryService } from "./email-otp-delivery.service.js";
import { SessionService } from "./session.service.js";

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const OTP_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_REQUESTS = 5;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(EmailOtpDeliveryService) private readonly otpDelivery: EmailOtpDeliveryService,
  ) {}

  private hashOtp(challengeId: string, code: string): string {
    return createHmac("sha256", this.config.get("SESSION_SECRET", { infer: true }))
      .update(`${challengeId}:${code}`)
      .digest("hex");
  }

  async requestEmailOtp(rawEmail: string, requestIp?: string) {
    const email = rawEmail.trim().toLowerCase();
    const recentRequests = await this.database.emailOtpChallenge.count({
      where: { email, createdAt: { gte: new Date(Date.now() - OTP_WINDOW_MS) } },
    });

    if (recentRequests >= MAX_OTP_REQUESTS) {
      throw new HttpException("Please wait before requesting another code.", HttpStatus.TOO_MANY_REQUESTS);
    }

    const challengeId = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

    await this.database.emailOtpChallenge.create({
      data: {
        id: challengeId,
        email,
        codeHash: this.hashOtp(challengeId, code),
        expiresAt: new Date(Date.now() + OTP_LIFETIME_MS),
        requestIp,
      },
    });

    try {
      await this.otpDelivery.deliver(email, code);
    } catch (error) {
      await this.database.emailOtpChallenge.delete({ where: { id: challengeId } });
      throw error;
    }

    return {
      challengeId,
      expiresInSeconds: OTP_LIFETIME_MS / 1000,
      ...(this.config.get("NODE_ENV", { infer: true }) !== "production" ? { developmentCode: code } : {}),
    };
  }

  async verifyEmailOtp(
    challengeId: string,
    code: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.database.$transaction(async (transaction) => {
      const challenge = await transaction.emailOtpChallenge.findUnique({ where: { id: challengeId } });

      if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) {
        throw new UnauthorizedException("Code is invalid or expired.");
      }

      if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
        throw new HttpException("Too many verification attempts.", HttpStatus.TOO_MANY_REQUESTS);
      }

      const actual = Buffer.from(challenge.codeHash, "hex");
      const expected = Buffer.from(this.hashOtp(challenge.id, code), "hex");

      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        await transaction.emailOtpChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } },
        });
        return null;
      }

      const consumed = await transaction.emailOtpChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      });
      if (consumed.count !== 1) return null;

      return transaction.user.upsert({
        where: { email: challenge.email },
        update: { lastLoginAt: new Date() },
        create: { email: challenge.email, lastLoginAt: new Date() },
      });
    });

    if (!user) {
      throw new UnauthorizedException("Code is invalid or expired.");
    }

    return this.sessions.create(user.id, metadata);
  }

  async beginGoogle(returnTo?: string) {
    const clientId = this.config.get("GOOGLE_CLIENT_ID", { infer: true });
    const redirectUri = this.config.get("GOOGLE_REDIRECT_URI", { infer: true });

    if (!clientId || !redirectUri) {
      throw new ServiceUnavailableException("Google login is not configured.");
    }

    const defaultUrl = this.config.get("WEB_URL", { infer: true });
    let safeRedirectUri = defaultUrl;
    if (returnTo) {
      try {
        const parsed = new URL(returnTo);
        const webUrl = new URL(defaultUrl);
        const adminUrl = new URL(this.config.get("ADMIN_URL", { infer: true }));
        if (parsed.origin === webUrl.origin || parsed.origin === adminUrl.origin) {
          safeRedirectUri = returnTo;
        }
      } catch {
        // fallback to default
      }
    }

    const state = randomUUID();
    await this.database.oAuthState.create({
      data: {
        stateHash: createHmac("sha256", this.config.get("SESSION_SECRET", { infer: true })).update(state).digest("hex"),
        redirectUri: safeRedirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  async completeGoogle(
    state: string,
    code: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const clientId = this.config.get("GOOGLE_CLIENT_ID", { infer: true });
    const clientSecret = this.config.get("GOOGLE_CLIENT_SECRET", { infer: true });
    const redirectUri = this.config.get("GOOGLE_REDIRECT_URI", { infer: true });

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException("Google login is not configured.");
    }

    const stateHash = createHmac("sha256", this.config.get("SESSION_SECRET", { infer: true })).update(state).digest("hex");
    const oauthState = await this.database.oAuthState.findUnique({ where: { stateHash } });

    if (!oauthState || oauthState.consumedAt || oauthState.expiresAt <= new Date()) {
      throw new BadRequestException("OAuth state is invalid or expired.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) throw new UnauthorizedException("Google authentication failed.");
    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) throw new UnauthorizedException("Google authentication failed.");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) throw new UnauthorizedException("Google profile could not be verified.");

    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!profile.sub || !profile.email || !profile.email_verified) {
      throw new UnauthorizedException("A verified Google email is required.");
    }

    const user = await this.database.$transaction(async (transaction) => {
      await transaction.oAuthState.update({ where: { id: oauthState.id }, data: { consumedAt: new Date() } });
      const account = await transaction.user.upsert({
        where: { email: profile.email!.toLowerCase() },
        update: { name: profile.name, avatarUrl: profile.picture, lastLoginAt: new Date() },
        create: {
          email: profile.email!.toLowerCase(),
          name: profile.name,
          avatarUrl: profile.picture,
          lastLoginAt: new Date(),
        },
      });
      await transaction.oAuthAccount.upsert({
        where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.sub! } },
        update: { userId: account.id },
        create: { provider: "google", providerAccountId: profile.sub!, userId: account.id },
      });
      return account;
    });

    const session = await this.sessions.create(user.id, metadata);
    return { ...session, redirectUri: oauthState.redirectUri };
  }

  async adminLogin(
    rawEmail: string,
    rawPassword: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const email = rawEmail.trim().toLowerCase();
    const password = rawPassword.trim();

    const configuredAdminEmail = this.config.get("PLATFORM_ADMIN_EMAIL", { infer: true })?.toLowerCase() || "admin@crmkaro.com";
    const configuredAdminPassword = this.config.get("PLATFORM_ADMIN_PASSWORD", { infer: true }) || "CRMKaro@Admin2026!";
    const allowedAdminEmailsStr = this.config.get("PLATFORM_ADMIN_EMAILS", { infer: true }) || "";
    const allowedAdminEmails = allowedAdminEmailsStr
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isEmailAllowed = email === configuredAdminEmail || allowedAdminEmails.includes(email);
    const isPasswordValid = password === configuredAdminPassword;

    if (!isEmailAllowed || !isPasswordValid) {
      throw new UnauthorizedException("Invalid administrator credentials. Access restricted.");
    }

    const user = await this.database.user.upsert({
      where: { email },
      update: { name: "Platform Administrator", lastLoginAt: new Date() },
      create: {
        email,
        name: "Platform Administrator",
        lastLoginAt: new Date(),
      },
    });

    const session = await this.sessions.create(user.id, metadata);
    return {
      session,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}
