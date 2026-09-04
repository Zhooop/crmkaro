import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { CrmController } from "./crm.controller.js";
import { CrmService } from "./crm.service.js";
import { LeadNotificationService } from "./lead-notification.service.js";
import { PublicLeadCaptureController } from "./public-lead-capture.controller.js";

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [CrmController, PublicLeadCaptureController],
  providers: [CrmService, LeadNotificationService],
  exports: [CrmService, LeadNotificationService],
})
export class CrmModule {}
