import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for database seeding.");
}

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const services = [
  { code: "people", name: "People", sortOrder: 10 },
  { code: "crm", name: "CRM", sortOrder: 20 },
  { code: "finance", name: "Finance", sortOrder: 30 },
  { code: "payroll", name: "Payroll", sortOrder: 40 },
  { code: "inventory", name: "Inventory", sortOrder: 50 },
] as const;

const permissionCodes = [
  "organisation.settings.read",
  "organisation.settings.update",
  "organisation.member.manage",
  "organisation.service.manage",
  "people.read",
  "people.create",
  "people.update",
  "people.archive",
  "people.import",
  "people.export",
  "crm.lead.read",
  "crm.lead.create",
  "crm.lead.update",
  "crm.lead.assign",
  "crm.lead.convert",
  "finance.invoice.read",
  "finance.invoice.manage",
  "finance.payment.read",
  "finance.payment.create",
  "finance.payment.refund",
  "finance.expense.manage",
  "payroll.employee.read",
  "payroll.employee.manage",
  "payroll.salary.view",
  "payroll.run.prepare",
  "payroll.run.approve",
  "payroll.run.markPaid",
  "inventory.product.read",
  "inventory.product.manage",
  "inventory.stock.manage",
  "inventory.negativeStock.override",
  "audit.read",
] as const;

async function seed() {
  for (const service of services) {
    await database.service.upsert({
      where: { code: service.code },
      update: { name: service.name, sortOrder: service.sortOrder },
      create: service,
    });
  }

  for (const code of permissionCodes) {
    await database.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        module: code.split(".")[0] ?? "system",
      },
    });
  }
}

seed()
  .then(() => database.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await database.$disconnect();
    process.exitCode = 1;
  });

