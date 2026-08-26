import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { InventoryController } from "./inventory.controller.js";
import { InventoryService } from "./inventory.service.js";
@Module({
  imports: [AuthModule, AccessModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
