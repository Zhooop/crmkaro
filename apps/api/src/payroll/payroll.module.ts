import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { PayrollController } from "./payroll.controller.js";
import { PayrollService } from "./payroll.service.js";
@Module({
  imports: [AuthModule, AccessModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
