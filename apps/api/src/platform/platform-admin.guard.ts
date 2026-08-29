import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DatabaseClient } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type { Environment } from "../config/environment.js";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.auth?.userId;

    if (!userId) {
      throw new UnauthorizedException("Platform administrator sign in required.");
    }

    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { email: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Administrator account not found or disabled.");
    }

    const userEmail = user.email.toLowerCase();
    const configuredAdminEmail = this.config.get("PLATFORM_ADMIN_EMAIL", { infer: true })?.toLowerCase() || "admin@crmkaro.com";
    const allowedAdminEmailsStr = this.config.get("PLATFORM_ADMIN_EMAILS", { infer: true }) || "";
    const allowedAdminEmails = allowedAdminEmailsStr
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isAuthorized = userEmail === configuredAdminEmail || allowedAdminEmails.includes(userEmail);

    if (!isAuthorized) {
      throw new ForbiddenException("Access denied. Restricted to Platform Administrators only.");
    }

    return true;
  }
}
