import { Body, Controller, Get, Inject, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { z } from "zod";
import { parseBody } from "../common/http/parse-body.js";
import { AuthService } from "./auth.service.js";
import { SessionGuard } from "./session.guard.js";
import { SESSION_COOKIE, SessionService } from "./session.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

const emailRequestSchema = z.object({ email: z.string().email().max(320) });
const emailVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

function clientMetadata(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.get("user-agent"),
  };
}

function setSessionCookie(response: Response, token: string, production: boolean) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    domain: production ? ".crmkaro.com" : undefined,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Post("email/request-otp")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestOtp(@Body() body: unknown, @Req() request: Request) {
    const input = parseBody(emailRequestSchema, body);
    return this.auth.requestEmailOtp(input.email, request.ip);
  }

  @Post("email/verify-otp")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyOtp(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const input = parseBody(emailVerifySchema, body);
    const result = await this.auth.verifyEmailOtp(input.challengeId, input.code, clientMetadata(request));
    setSessionCookie(response, result.token, process.env.NODE_ENV === "production");
    return { userId: result.session.userId };
  }

  @Get("google/start")
  async googleStart(@Query("returnTo") returnTo: string | undefined, @Res() response: Response) {
    response.redirect(await this.auth.beginGoogle(returnTo));
  }

  @Get("google/callback")
  async googleCallback(
    @Query("state") state: string,
    @Query("code") code: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const result = await this.auth.completeGoogle(state, code, clientMetadata(request));
    setSessionCookie(response, result.token, process.env.NODE_ENV === "production");
    response.redirect(result.redirectUri);
  }

  @Get("me")
  @UseGuards(SessionGuard)
  me(@Req() request: AuthenticatedRequest) {
    return request.auth;
  }

  @Post("logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
    await this.sessions.revoke(cookies?.[SESSION_COOKIE]);
    response.clearCookie(SESSION_COOKIE, {
      path: "/",
      domain: process.env.NODE_ENV === "production" ? ".crmkaro.com" : undefined,
    });
    return { success: true };
  }
}
