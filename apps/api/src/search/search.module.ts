import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { SearchController } from "./search.controller.js";
import { SearchService } from "./search.service.js";

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
