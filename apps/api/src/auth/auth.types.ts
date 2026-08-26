import type { Request } from "express";

export type AuthenticatedSession = {
  sessionId: string;
  userId: string;
  activeOrganisationId: string | null;
  email: string;
  name: string | null;
  membershipId?: string;
  roleId?: string;
  roleCode?: string;
};

export type AuthenticatedRequest = Request & {
  auth: AuthenticatedSession;
};
