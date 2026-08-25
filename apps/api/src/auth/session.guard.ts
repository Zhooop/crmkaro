import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { SESSION_COOKIE, SessionService } from "./session.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
    request.auth = await this.sessions.authenticate(cookies?.[SESSION_COOKIE]);
    return true;
  }
}
