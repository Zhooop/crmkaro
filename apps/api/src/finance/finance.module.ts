import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { FinanceController } from "./finance.controller.js";
import { FinanceService } from "./finance.service.js";
@Module({
  imports: [AuthModule, AccessModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
