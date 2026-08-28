import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });
dotenv.config();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client.js";
import { permissions, rolePresets } from "../../permissions/src/index.js";

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for database seeding.");
}

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const services = [
  { code: "people", name: "People & HR", sortOrder: 10 },
  { code: "crm", name: "Sales CRM", sortOrder: 20 },
  { code: "finance", name: "Invoicing & Finance", sortOrder: 30 },
  { code: "payroll", name: "Payroll", sortOrder: 40 },
  { code: "inventory", name: "Stock & Inventory", sortOrder: 50 },
] as const;

async function seed() {
  console.log("Seeding services and permissions...");
  await database.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
  for (const service of services) {
    await database.service.upsert({
      where: { code: service.code },
      update: { name: service.name, sortOrder: service.sortOrder },
      create: service,
    });
  }

  for (const code of permissions) {
    await database.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        module: code.split(".")[0] ?? "system",
      },
    });
  }

  // 1. Ensure Super Admin / Owner User exists
  const ownerEmail = "zhoopinfotech@gmail.com";
  const user = await database.user.upsert({
    where: { email: ownerEmail },
    update: { name: "Pushpaindu Nath", status: "ACTIVE" },
    create: {
      email: ownerEmail,
      name: "Pushpaindu Nath",
      status: "ACTIVE",
    },
  });

  const permissionRows = await database.permission.findMany({ select: { id: true, code: true } });
  const allServices = await database.service.findMany();

  // 2. Seed Sample Organisations
  const sampleOrgs = [
    {
      name: "Parlour Go",
      slug: "parlour-go",
      businessType: "Beauty & Wellness Salon",
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
    {
      name: "Zhooop Tech Ventures",
      slug: "zhooop-tech",
      businessType: "Software & Technology",
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
    {
      name: "Gautam Motors",
      slug: "gautam-motors",
      businessType: "Automotive Dealership",
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
  ];

  for (const orgData of sampleOrgs) {
    const org = await database.organisation.upsert({
      where: { slug: orgData.slug },
      update: { name: orgData.name, businessType: orgData.businessType, status: "ACTIVE" },
      create: {
        name: orgData.name,
        slug: orgData.slug,
        businessType: orgData.businessType,
        currency: orgData.currency,
        timezone: orgData.timezone,
        status: "ACTIVE",
      },
    });

    // Create Roles for organisation
    const createdRoles = [];
    for (const [code, preset] of Object.entries(rolePresets)) {
      let role = await database.role.findFirst({
        where: { organisationId: org.id, code },
      });
      if (!role) {
        role = await database.role.create({
          data: {
            organisationId: org.id,
            code,
            name: preset.name,
            isSystem: false,
          },
        });
      }
      createdRoles.push(role);
    }

    const ownerRole = createdRoles.find((r) => r.code === "owner");
    if (ownerRole) {
      await database.organisationMembership.upsert({
        where: {
          organisationId_userId: { organisationId: org.id, userId: user.id },
        },
        update: { status: "ACTIVE", roleId: ownerRole.id },
        create: {
          organisationId: org.id,
          userId: user.id,
          roleId: ownerRole.id,
          status: "ACTIVE",
        },
      });
    }

    // Role permissions
    for (const role of createdRoles) {
      const preset = rolePresets[role.code as keyof typeof rolePresets];
      if (preset) {
        for (const pRow of permissionRows) {
          if ((preset.permissions as readonly string[]).includes(pRow.code)) {
            await database.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: pRow.id,
                },
              },
              update: {},
              create: {
                organisationId: org.id,
                roleId: role.id,
                permissionId: pRow.id,
              },
            });
          }
        }
      }
    }

    // Entitle all services
    for (const s of allServices) {
      await database.organisationService.upsert({
        where: {
          organisationId_serviceId: { organisationId: org.id, serviceId: s.id },
        },
        update: { status: "ACTIVE" },
        create: {
          organisationId: org.id,
          serviceId: s.id,
          status: "ACTIVE",
        },
      });
    }

    // Seed sample People
    const existingPerson = await database.person.findFirst({ where: { organisationId: org.id } });
    if (!existingPerson) {
      await database.person.createMany({
        data: [
          {
            organisationId: org.id,
            displayName: "Aarav Sharma",
            email: "aarav.sharma@example.com",
            primaryPhone: "+91 9876543210",
            status: "ACTIVE",
          },
          {
            organisationId: org.id,
            displayName: "Priya Patel",
            email: "priya.patel@example.com",
            primaryPhone: "+91 9811223344",
            status: "ACTIVE",
          },
          {
            organisationId: org.id,
            displayName: "Rohit Verma",
            email: "rohit.verma@example.com",
            primaryPhone: "+91 9899001122",
            status: "ACTIVE",
          },
        ],
      });
    }

    // Seed sample CRM Pipeline & Leads
    const existingPipeline = await database.pipeline.findFirst({ where: { organisationId: org.id } });
    if (!existingPipeline) {
      const pipeline = await database.pipeline.create({
        data: {
          organisationId: org.id,
          name: "Standard Sales Pipeline",
          isDefault: true,
        },
      });

      const [firstStage] = await Promise.all([
        database.pipelineStage.create({
          data: { organisationId: org.id, pipelineId: pipeline.id, name: "New Inquiries", position: 1, isConverted: false, isLost: false, colour: "#3b82f6" },
        }),
        database.pipelineStage.create({
          data: { organisationId: org.id, pipelineId: pipeline.id, name: "Consultation Booked", position: 2, isConverted: false, isLost: false, colour: "#8b5cf6" },
        }),
        database.pipelineStage.create({
          data: { organisationId: org.id, pipelineId: pipeline.id, name: "Proposal Sent", position: 3, isConverted: false, isLost: false, colour: "#f59e0b" },
        }),
        database.pipelineStage.create({
          data: { organisationId: org.id, pipelineId: pipeline.id, name: "Won / Enrolled", position: 4, isConverted: true, isLost: false, colour: "#10b981" },
        }),
      ]);
      if (firstStage) {
        await database.lead.createMany({
          data: [
            {
              organisationId: org.id,
              pipelineId: pipeline.id,
              stageId: firstStage.id,
              name: "Corporate Annual Package - 25 Members",
              expectedValueMinor: 12500000,
              status: "OPEN",
            },
            {
              organisationId: org.id,
              pipelineId: pipeline.id,
              stageId: firstStage.id,
              name: "Premium Client VIP Membership",
              expectedValueMinor: 4500000,
              status: "OPEN",
            },
          ],
        });
      }
    }

    // Seed Sample Audit Logs
    await database.auditLog.createMany({
      data: [
        {
          organisationId: org.id,
          actorUserId: user.id,
          action: "organisation.onboarded",
          entityType: "ORGANISATION",
          entityId: org.id,
          metadata: { name: org.name, slug: org.slug },
        },
        {
          organisationId: org.id,
          actorUserId: user.id,
          action: "service.entitled.all",
          entityType: "SERVICE",
          entityId: org.id,
          metadata: { services: ["people", "crm", "finance", "payroll", "inventory"] },
        },
      ],
    });
  }

  console.log("Seeding completed successfully!");
}

seed()
  .then(() => database.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await database.$disconnect();
    process.exitCode = 1;
  });
