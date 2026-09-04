import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { FinanceController } from "./finance.controller.js";
import { FinanceService } from "./finance.service.js";
import { PublicPaymentController } from "./public-payment.controller.js";
import { RazorpayService } from "./razorpay.service.js";

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [FinanceController, PublicPaymentController],
  providers: [FinanceService, RazorpayService],
  exports: [FinanceService, RazorpayService],
})
export class FinanceModule {}

