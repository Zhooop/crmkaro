import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { CrmController } from "./crm.controller.js";
import { CrmService } from "./crm.service.js";
@Module({
  imports: [AuthModule, AccessModule],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
