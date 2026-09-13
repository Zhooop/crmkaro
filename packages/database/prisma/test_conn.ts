import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });
dotenv.config();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client.js";

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  await database.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
  const orgs = await database.organisation.findMany({
    select: { id: true, name: true, businessType: true },
  });
  console.log("=== ORGS FOUND ===", orgs);
}

main().catch(console.error).finally(() => database.$disconnect());
