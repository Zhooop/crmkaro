import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { SessionGuard } from "../auth/session.guard.js";
import { PlatformService } from "./platform.service.js";

@Controller("platform")
@UseGuards(SessionGuard)
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("overview")
  overview() {
    return this.platform.overview();
  }

  @Get("organisations")
  organisations() {
    return this.platform.listOrganisations();
  }

  @Get("audit")
  audit(@Query("limit") limit?: string) {
    const parsedLimit = z.coerce.number().int().min(1).max(100).catch(50).parse(limit);
    return this.platform.listAudit(parsedLimit);
  }
}
