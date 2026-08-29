import { Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { SESSION_COOKIE, SessionService } from "./session.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
    const authHeader = (request as Request).headers?.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
    const token = cookies?.[SESSION_COOKIE] || bearerToken;
    request.auth = await this.sessions.authenticate(token);
    return true;
  }
}
