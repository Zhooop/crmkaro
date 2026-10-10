import type { Prisma } from "./generated/client.js";
import type { DatabaseClient } from "./client.js";

export type TenantTransaction = Prisma.TransactionClient;

export async function withTenant<T>(
  database: DatabaseClient,
  organisationId: string,
  userId: string,
  operation: (transaction: TenantTransaction) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
): Promise<T> {
  return database.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_organisation_id', ${organisationId}, true)`;
      await transaction.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      return operation(transaction);
    },
    { maxWait: 10000, timeout: 15000, ...options },
  );
}

export async function withUser<T>(
  database: DatabaseClient,
  userId: string,
  operation: (transaction: TenantTransaction) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
): Promise<T> {
  return database.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      return operation(transaction);
    },
    { maxWait: 10000, timeout: 15000, ...options },
  );
}

export async function withPlatformAdmin<T>(
  database: DatabaseClient,
  operation: (transaction: TenantTransaction) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
): Promise<T> {
  return database.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      return operation(transaction);
    },
    { maxWait: 10000, timeout: 15000, ...options },
  );
}
