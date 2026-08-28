import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { PlatformController } from "./platform.controller.js";
import { PlatformService } from "./platform.service.js";

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
