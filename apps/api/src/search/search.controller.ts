import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { SessionGuard } from "../auth/session.guard.js";
import { ActiveOrganisationGuard } from "../access/active-organisation.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SearchService } from "./search.service.js";

@Controller("search")
@UseGuards(SessionGuard, ActiveOrganisationGuard)
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Req() request: AuthenticatedRequest,
    @Query("q") query?: string,
  ) {
    const parsedQuery = z.string().trim().max(100).catch("").parse(query || "");
    return this.searchService.search(
      request.auth.activeOrganisationId!,
      request.auth.userId,
      parsedQuery,
    );
  }
}
