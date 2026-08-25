import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { DatabaseClient } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import type { AuthenticatedSession } from "./auth.types.js";

export const SESSION_COOKIE = "crm_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class SessionService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async create(userId: string, metadata: { ipAddress?: string; userAgent?: string }) {
    const token = randomBytes(32).toString("base64url");
    const session = await this.database.authSession.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent?.slice(0, 500),
      },
    });

    return { token, session };
  }

  async authenticate(token: string | undefined): Promise<AuthenticatedSession> {
    if (!token) {
      throw new UnauthorizedException("Authentication required.");
    }

    const session = await this.database.authSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") {
      throw new UnauthorizedException("Session is invalid or expired.");
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      activeOrganisationId: session.activeOrganisationId,
      email: session.user.email,
      name: session.user.name,
    };
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.database.authSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async setActiveOrganisation(sessionId: string, organisationId: string): Promise<void> {
    await this.database.authSession.update({
      where: { id: sessionId },
      data: { activeOrganisationId: organisationId, lastSeenAt: new Date() },
    });
  }
}

