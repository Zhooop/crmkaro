import type { Prisma } from "./generated/client.js";
import type { DatabaseClient } from "./client.js";

export type TenantTransaction = Prisma.TransactionClient;

export async function withTenant<T>(
  database: DatabaseClient,
  organisationId: string,
  operation: (transaction: TenantTransaction) => Promise<T>,
): Promise<T> {
  return database.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.current_organisation_id', ${organisationId}, true)`;
    return operation(transaction);
  });
}

