import type { Request } from "express";

export type AuthenticatedSession = {
  sessionId: string;
  userId: string;
  activeOrganisationId: string | null;
  email: string;
  name: string | null;
};

export type AuthenticatedRequest = Request & {
  auth: AuthenticatedSession;
};

