import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { ActiveOrganisationGuard } from "../access/active-organisation.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { SESSION_COOKIE } from "../auth/session.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SubscriptionsService } from "./subscriptions.service.js";

const initiateCheckoutSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  planCode: z.string().optional(),
});

const completeCheckoutSchema = z.object({
  organisationName: z.string().min(1),
  businessType: z.string().min(1),
  industry: z.string().optional(),
  planId: z.string().optional(),
  subscriptionId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().optional(),
  paymentMethod: z.string().optional(),
});

const createAutoPaySchema = z.object({
  planId: z.string().min(1),
});

const verifyAutoPaySchema = z.object({
  planId: z.string().optional(),
  razorpaySubscriptionId: z.string().optional(),
  subscriptionId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  paymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
  signature: z.string().optional(),
  paymentMethod: z.string().optional(),
});

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(
    @Inject(SubscriptionsService) private readonly subscriptions: SubscriptionsService,
  ) {}

  /**
   * Generates a Razorpay Subscription Mandate for the tenant.
   */
  @Post("create-autopay")
  @UseGuards(SessionGuard, ActiveOrganisationGuard)
  createAutoPay(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = createAutoPaySchema.parse(body);
    return this.subscriptions.createAutoPaySubscription(
      request.auth.activeOrganisationId!,
      request.auth.userId,
      input.planId,
    );
  }

  /**
   * Verifies mandate signature and activates the organization's subscription.
   */
  @Post("verify-autopay")
  @UseGuards(SessionGuard, ActiveOrganisationGuard)
  verifyAutoPay(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = verifyAutoPaySchema.parse(body);
    const subId = input.razorpaySubscriptionId || input.subscriptionId;
    const payId = input.razorpayPaymentId || input.paymentId;
    const sig = input.razorpaySignature || input.signature;
    return this.subscriptions.verifyAutoPaySubscription(
      request.auth.activeOrganisationId!,
      request.auth.userId,
      {
        planId: input.planId,
        razorpaySubscriptionId: subId || "",
        razorpayPaymentId: payId || "",
        razorpaySignature: sig,
        paymentMethod: input.paymentMethod,
      },
    );
  }

  /**
   * Returns current active subscription details for tenant.
   */
  @Get("current")
  @UseGuards(SessionGuard, ActiveOrganisationGuard)
  current(@Req() request: AuthenticatedRequest) {
    return this.subscriptions.getCurrentSubscription(
      request.auth.activeOrganisationId!,
    );
  }

  /**
   * Public 1-Click Launch Offer Pre-Checkout
   */
  @Post("launch-checkout/initiate")
  async initiateLaunchCheckout(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const input = initiateCheckoutSchema.parse(body);
      const metadata = {
        ipAddress: request.ip,
        userAgent: request.headers?.["user-agent"],
        platform: "WEB",
      };
      const result = await this.subscriptions.initiateLaunchCheckout(input, metadata);
      response.cookie(SESSION_COOKIE, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        domain: process.env.NODE_ENV === "production" ? ".crmkaro.com" : undefined,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });
      return result;
    } catch (err: any) {
      console.error("INITIATE_ERROR_DEBUG:", err);
      return {
        error: true,
        message: err.message,
        stack: err.stack,
      };
    }
  }

  /**
   * Finalizes Launch Offer Onboarding after payment
   */
  @Post("launch-checkout/complete")
  @UseGuards(SessionGuard)
  completeLaunchCheckout(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = completeCheckoutSchema.parse(body);
    return this.subscriptions.completeLaunchCheckout(
      request.auth.userId,
      request.auth.sessionId,
      input,
    );
  }

  /**
   * Razorpay Webhook listener for recurring monthly AutoPay debits.
   */
  @Post("webhook")
  webhook(
    @Headers("x-razorpay-signature") signature: string,
    @Body() body: any,
  ) {
    // Webhook received from Razorpay on monthly auto-debit:
    // event: "subscription.charged"
    return { status: "received" };
  }
}
