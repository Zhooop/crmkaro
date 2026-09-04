import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Inject,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import type { DatabaseClient } from "@crmkaro/database";
import { withPlatformAdmin, withTenant } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import { normaliseEmail, normalisePhone } from "../people/people.utils.js";
import { LeadNotificationService } from "./lead-notification.service.js";

@Controller("leads")
export class PublicLeadCaptureController {
  private readonly logger = new Logger(PublicLeadCaptureController.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(LeadNotificationService) private readonly leadNotification: LeadNotificationService,
  ) {}

  @Post("capture")
  async captureLead(
    @Query("key") queryKey: string | undefined,
    @Headers("x-api-key") headerKey: string | undefined,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: any,
  ) {
    const rawKey =
      queryKey ||
      headerKey ||
      (authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined);

    if (!rawKey) {
      throw new UnauthorizedException(
        "API key is required. Pass ?key=YOUR_KEY in query string, x-api-key header, or Bearer token.",
      );
    }

    // 1. Look up organisation by API key
    const setting = await withPlatformAdmin(this.database, async (tx) => {
      return tx.organisationLeadSetting.findUnique({
        where: { webhookApiKey: rawKey },
        include: {
          organisation: {
            include: {
              services: { include: { service: true } },
            },
          },
        },
      });
    });

    if (!setting) {
      throw new UnauthorizedException("Invalid API key or organisation not found.");
    }

    const org = setting.organisation;

    // 2. Strict Service Scoping: Confirm CRM service is active
    const hasCrm = org.services.some(
      (s) =>
        s.service.code === "crm" &&
        (s.status === "ACTIVE" || s.status === "TRIAL"),
    );

    if (!hasCrm) {
      throw new BadRequestException(
        "CRM service is not active for this organisation. Enable CRM in Settings to capture leads.",
      );
    }

    // 3. Extract and normalize lead fields
    const name =
      body.name ||
      body.fullName ||
      body.full_name ||
      body.customer_name ||
      body.lead_name ||
      "Anonymous Prospect";

    const rawPhone = body.phone || body.mobile || body.phone_number || body.contact || null;
    const rawEmail = body.email || body.email_address || null;
    const source = body.source || body.campaign || body.ad_name || "Website / Ad Ingestion";
    const notes = body.notes || body.message || body.inquiry || body.comment || null;

    let expectedValueMinor: number | null = null;
    const rawValue = body.expectedValueMinor || body.value || body.budget || body.amount;
    if (rawValue) {
      const num = Number(rawValue);
      if (!isNaN(num) && num > 0) {
        // If greater than 100,000 assume already minor or in whole rupees
        expectedValueMinor = num > 100000 ? Math.round(num) : Math.round(num * 100);
      }
    }

    // 4 & 5. Resolve pipeline & create lead inside organisation context via platform admin
    const lead: any = await withPlatformAdmin(this.database, async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organisation_id', ${org.id}, true)`;

      let targetPipelineId = setting.defaultPipelineId;
      let targetStageId = setting.defaultStageId;

      if (!targetPipelineId || !targetStageId) {
        let defaultPipeline = await tx.pipeline.findFirst({
          where: { organisationId: org.id, isActive: true },
          include: {
            stages: {
              where: { isActive: true },
              orderBy: { position: "asc" },
            },
          },
        });

        if (!defaultPipeline || !defaultPipeline.stages || defaultPipeline.stages.length === 0) {
          const pipe = await tx.pipeline.create({
            data: {
              organisationId: org.id,
              name: "Standard Sales Pipeline",
              isDefault: true,
            },
          });
          const stage1 = await tx.pipelineStage.create({
            data: {
              organisationId: org.id,
              pipelineId: pipe.id,
              name: "New Inquiries",
              position: 10,
              colour: "#3b82f6",
            },
          });
          await tx.pipelineStage.create({
            data: {
              organisationId: org.id,
              pipelineId: pipe.id,
              name: "Contacted / In Discussion",
              position: 20,
              colour: "#8b5cf6",
            },
          });
          await tx.pipelineStage.create({
            data: {
              organisationId: org.id,
              pipelineId: pipe.id,
              name: "Site Visit / Meeting",
              position: 30,
              colour: "#f59e0b",
            },
          });
          await tx.pipelineStage.create({
            data: {
              organisationId: org.id,
              pipelineId: pipe.id,
              name: "Converted (Won)",
              position: 40,
              colour: "#10b981",
              isConverted: true,
            },
          });
          defaultPipeline = {
            ...pipe,
            stages: [stage1],
          };
        }

        targetPipelineId = defaultPipeline.id;
        targetStageId = defaultPipeline.stages[0]!.id;
      }

      const createdLead = await tx.lead.create({
        data: {
          organisationId: org.id,
          pipelineId: targetPipelineId,
          stageId: targetStageId,
          name: String(name).trim().slice(0, 180),
          phone: rawPhone ? String(rawPhone).trim().slice(0, 32) : null,
          phoneNormalised: rawPhone ? normalisePhone(String(rawPhone)) : null,
          email: rawEmail ? String(rawEmail).trim().toLowerCase().slice(0, 320) : null,
          emailNormalised: rawEmail ? normaliseEmail(String(rawEmail)) : null,
          source: String(source).trim().slice(0, 80),
          expectedValueMinor,
          status: "OPEN",
        },
      });

      if (notes) {
        await tx.leadNote.create({
          data: {
            organisationId: org.id,
            leadId: createdLead.id,
            body: `Initial Inquiry: ${String(notes).trim().slice(0, 2000)}`,
          },
        });
      }

      await tx.leadActivity.create({
        data: {
          organisationId: org.id,
          leadId: createdLead.id,
          action: "LEAD_INGESTED",
          summary: `Lead captured via API (${source})`,
        },
      });

      return createdLead;
    });

    this.logger.log(`📥 Captured new lead "${lead.name}" for org "${org.name}" (${org.id}) via ${source}`);

    // 6. Asynchronously dispatch email notification alert to business owner (e.g. Rajesh Realty)
    void this.leadNotification.sendNewLeadAlert(org.id, {
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      expectedValueMinor: lead.expectedValueMinor,
      notes,
    });

    return {
      success: true,
      leadId: lead.id,
      name: lead.name,
      source: lead.source,
      message: "Lead successfully captured and alert dispatched.",
    };
  }
}
