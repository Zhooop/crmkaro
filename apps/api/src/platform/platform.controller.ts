import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { SessionGuard } from "../auth/session.guard.js";
import { PlatformAdminGuard } from "./platform-admin.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { PlatformService } from "./platform.service.js";

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]),
});

const updateServicesSchema = z.object({
  serviceCodes: z.array(z.string()),
});

const createOrgSchema = z.object({
  name: z.string().min(2),
  businessType: z.string().trim().min(2, "Business type is required"),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  serviceCodes: z.array(z.string()).optional(),
});

const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]),
  blockReason: z.string().optional(),
});

const toggleVerifySchema = z.object({
  isVerified: z.boolean(),
});

const createBannerSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  imageUrl: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
  targetPlatform: z.enum(["ALL", "WEB", "MOBILE"]).optional(),
  category: z.string().optional(),
  priority: z.coerce.number().int().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

const updateBannerSchema = createBannerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const broadcastNotificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().optional(),
  targetAudience: z.string().optional(),
  actionUrl: z.string().optional(),
});

const refundTransactionSchema = z.object({
  reason: z.string().optional(),
});

const createTeamMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.string().min(2),
});

const updateTeamMemberSchema = z.object({
  role: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ==========================================
// PUBLIC PLATFORM CONTROLLER (Web & Mobile)
// ==========================================
@Controller("platform/public")
export class PlatformPublicController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("banners")
  banners(@Query("platform") platform?: string) {
    return this.platform.listPublicBanners(platform);
  }

  @Get("notifications")
  notifications(@Query("audience") audience?: string) {
    return this.platform.listPublicNotifications(audience);
  }
}

// ==========================================
// MASTER PLATFORM ADMIN CONTROLLER
// ==========================================
@Controller("platform")
@UseGuards(SessionGuard, PlatformAdminGuard)
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

  @Patch("organisations/:id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = updateStatusSchema.parse(body);
    return this.platform.updateOrganisationStatus(id, input.status, req.auth?.userId);
  }

  @Patch("organisations/:id/services")
  updateServices(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = updateServicesSchema.parse(body);
    return this.platform.updateOrganisationServices(id, input.serviceCodes, req.auth?.userId);
  }

  @Post("organisations")
  createOrganisation(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = createOrgSchema.parse(body);
    return this.platform.createOrganisation(input, req.auth?.userId);
  }

  @Get("audit")
  audit(@Query("limit") limit?: string) {
    const parsedLimit = z.coerce.number().int().min(1).max(100).catch(50).parse(limit);
    return this.platform.listAudit(parsedLimit);
  }

  @Get("health")
  health() {
    return this.platform.getHealth();
  }

  // --- 1. USER MANAGEMENT ---
  @Get("users")
  listUsers(
    @Query("search") search?: string,
    @Query("platform") platform?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = z.coerce.number().int().min(1).max(200).catch(50).parse(limit);
    return this.platform.listUsers({ search, platform, status, limit: parsedLimit });
  }

  @Patch("users/:id/status")
  updateUserStatus(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = updateUserStatusSchema.parse(body);
    return this.platform.updateUserStatus(id, input.status, input.blockReason, req.auth?.userId);
  }

  @Patch("users/:id/verify")
  toggleUserVerify(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = toggleVerifySchema.parse(body);
    return this.platform.toggleUserVerify(id, input.isVerified, req.auth?.userId);
  }

  // --- 2. CMS & BANNERS ---
  @Get("banners")
  listBanners() {
    return this.platform.listBanners();
  }

  @Post("banners")
  createBanner(@Body() body: unknown) {
    const input = createBannerSchema.parse(body);
    return this.platform.createBanner(input);
  }

  @Patch("banners/:id")
  updateBanner(@Param("id") id: string, @Body() body: unknown) {
    const input = updateBannerSchema.parse(body);
    return this.platform.updateBanner(id, input);
  }

  @Delete("banners/:id")
  deleteBanner(@Param("id") id: string) {
    return this.platform.deleteBanner(id);
  }

  // --- 3. PAYMENTS & TRANSACTIONS ---
  @Get("transactions")
  listTransactions(
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = z.coerce.number().int().min(1).max(200).catch(50).parse(limit);
    return this.platform.listTransactions({ status, limit: parsedLimit });
  }

  @Post("transactions/:id/refund")
  refundTransaction(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = refundTransactionSchema.parse(body);
    return this.platform.refundTransaction(id, input.reason, req.auth?.userId);
  }

  // --- 4. BROADCAST NOTIFICATIONS ---
  @Get("notifications")
  listNotifications() {
    return this.platform.listNotifications();
  }

  @Post("notifications/broadcast")
  broadcastNotification(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = broadcastNotificationSchema.parse(body);
    return this.platform.broadcastNotification(input, req.auth?.email);
  }

  // --- 5. BUSINESS REPORTS & ANALYTICS ---
  @Get("reports/overview")
  reportsOverview() {
    return this.platform.getReportsOverview();
  }

  // --- 6. TEAM & PERMISSIONS ---
  @Get("team")
  listTeamMembers() {
    return this.platform.listTeamMembers();
  }

  @Post("team")
  createTeamMember(@Body() body: unknown) {
    const input = createTeamMemberSchema.parse(body);
    return this.platform.createTeamMember(input);
  }

  @Patch("team/:id")
  updateTeamMember(@Param("id") id: string, @Body() body: unknown) {
    const input = updateTeamMemberSchema.parse(body);
    return this.platform.updateTeamMember(id, input);
  }

  @Delete("team/:id")
  deleteTeamMember(@Param("id") id: string) {
    return this.platform.deleteTeamMember(id);
  }
}
