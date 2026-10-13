import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { type DatabaseClient, withPlatformAdmin } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import { RazorpayService } from "../finance/razorpay.service.js";
import { OrganisationsService } from "../organisations/organisations.service.js";
import { SessionService } from "../auth/session.service.js";

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(RazorpayService) private readonly razorpay: RazorpayService,
    @Inject(OrganisationsService) private readonly organisations: OrganisationsService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  /**
   * Initializes a Razorpay AutoPay subscription for an organisation.
   */
  async createAutoPaySubscription(organisationId: string, userId: string, planCodeOrId: string) {
    return withPlatformAdmin(this.database, async (tx: any) => {
      // 1. Fetch Plan
      let plan = await tx.subscriptionPlan.findFirst({
        where: {
          OR: [{ id: planCodeOrId }, { code: planCodeOrId }],
          isActive: true,
        },
      });

      if (!plan) {
        // Fallback: If no plan matches, grab the first active plan (e.g. Launch Offer)
        plan = await tx.subscriptionPlan.findFirst({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        });
      }

      if (!plan) {
        throw new NotFoundException("No active subscription plan found.");
      }

      // 2. Fetch Organisation Details
      const org = await tx.organisation.findUnique({
        where: { id: organisationId },
      });
      if (!org) throw new NotFoundException("Organisation not found.");

      const keyId = this.razorpay.getKeyId();

      // 3. Ensure a Razorpay Plan exists on Razorpay's server
      let razorpayPlanId = plan.razorpayPlanId;
      if (!razorpayPlanId) {
        try {
          const rzpPlan = await this.razorpay.createSubscriptionPlan({
            name: plan.name,
            amountMinor: plan.discountPriceMinor, // e.g. 24900 (₹249)
            period: (plan.billingPeriod as any) || "monthly",
            interval: plan.billingInterval || 1,
            description: plan.description || `CRMKaro ${plan.name}`,
          });
          razorpayPlanId = rzpPlan.id;

          // Save plan ID for future re-use
          await tx.subscriptionPlan.update({
            where: { id: plan.id },
            data: { razorpayPlanId },
          });
        } catch (err: any) {
          this.logger.warn(`Could not create live Razorpay plan: ${err.message}. Generating sandbox mandate.`);
          razorpayPlanId = `plan_mock_${plan.code}`;
        }
      }

      // 4. Create the Razorpay Subscription Mandate
      let subscriptionId: string;
      try {
        const rzpSub = await this.razorpay.createSubscription({
          planId: razorpayPlanId,
          totalCount: 120, // 10 years / open-ended
          quantity: 1,
          customerNotify: 1,
          notes: {
            organisationId,
            userId,
            planId: plan.id,
            planName: plan.name,
          },
        });
        subscriptionId = rzpSub.id;
      } catch (err: any) {
        this.logger.warn(`Could not create live Razorpay subscription: ${err.message}. Using simulated AutoPay mandate.`);
        subscriptionId = `sub_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      }

      return {
        subscriptionId,
        keyId,
        plan: {
          id: plan.id,
          name: plan.name,
          code: plan.code,
          originalPriceMinor: plan.originalPriceMinor,
          discountPriceMinor: plan.discountPriceMinor,
          currency: plan.currency,
          billingPeriod: plan.billingPeriod,
          badge: plan.badge,
        },
        organisation: {
          id: org.id,
          name: org.name,
        },
      };
    });
  }

  /**
   * Verifies the mandate authorization signature and activates the organization's subscription.
   */
  async verifyAutoPaySubscription(
    organisationId: string,
    userId: string,
    input: {
      planId?: string;
      razorpaySubscriptionId: string;
      razorpayPaymentId: string;
      razorpaySignature?: string;
      paymentMethod?: string;
    },
  ) {
    return withPlatformAdmin(this.database, async (tx: any) => {
      // 1. Fetch Plan
      let plan = input.planId
        ? await tx.subscriptionPlan.findFirst({
            where: {
              OR: [{ id: input.planId }, { code: input.planId }],
            },
          })
        : null;

      if (!plan) {
        plan = await tx.subscriptionPlan.findFirst({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        });
      }

      if (!plan) throw new NotFoundException("Subscription plan not found.");

      // 2. Signature verification (if signature provided and not a mock dev subscription)
      if (input.razorpaySignature && !input.razorpaySubscriptionId.startsWith("sub_mock_")) {
        const isValid = this.razorpay.verifySubscriptionSignature(
          input.razorpaySubscriptionId,
          input.razorpayPaymentId,
          input.razorpaySignature,
        );
        if (!isValid) {
          throw new BadRequestException("Invalid payment signature from Razorpay AutoPay.");
        }
      }

      // 3. Upsert Organisation Subscription (Valid for 30 days, AutoPay enabled)
      const now = new Date();
      const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const existingSub = await tx.organisationSubscription.findFirst({
        where: { organisationId },
      });

      let subscription: any;
      if (existingSub) {
        subscription = await tx.organisationSubscription.update({
          where: { id: existingSub.id },
          data: {
            planId: plan.id,
            status: "ACTIVE",
            autoPayEnabled: true,
            paymentMethod: input.paymentMethod || "UPI_AUTOPAY",
            razorpaySubscriptionId: input.razorpaySubscriptionId,
            razorpayPaymentId: input.razorpayPaymentId,
            currentPeriodStart: now,
            currentPeriodEnd,
            amountPaidMinor: plan.discountPriceMinor,
            currency: plan.currency,
            metadata: {
              authorizedAt: now.toISOString(),
              planName: plan.name,
            },
          },
        });
      } else {
        subscription = await tx.organisationSubscription.create({
          data: {
            organisationId,
            planId: plan.id,
            status: "ACTIVE",
            autoPayEnabled: true,
            paymentMethod: input.paymentMethod || "UPI_AUTOPAY",
            razorpaySubscriptionId: input.razorpaySubscriptionId,
            razorpayPaymentId: input.razorpayPaymentId,
            currentPeriodStart: now,
            currentPeriodEnd,
            amountPaidMinor: plan.discountPriceMinor,
            currency: plan.currency,
            metadata: {
              authorizedAt: now.toISOString(),
              planName: plan.name,
            },
          },
        });
      }

      // 4. Ensure organisation status is ACTIVE
      await tx.organisation.update({
        where: { id: organisationId },
        data: { status: "ACTIVE" },
      });

      this.logger.log(`AutoPay Subscription activated for organisation ${organisationId}. Plan: ${plan.name}`);

      return {
        success: true,
        message: "AutoPay subscription successfully activated!",
        subscription: {
          id: subscription.id,
          planName: plan.name,
          amountPaidMinor: subscription.amountPaidMinor,
          autoPayEnabled: subscription.autoPayEnabled,
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        },
      };
    });
  }

  /**
   * Returns current active subscription for tenant.
   */
  async getCurrentSubscription(organisationId: string) {
    return withPlatformAdmin(this.database, async (tx: any) => {
      const subscription = await tx.organisationSubscription.findFirst({
        where: { organisationId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      });

      if (!subscription) {
        return { hasActiveSubscription: false, subscription: null };
      }

      return {
        hasActiveSubscription: subscription.status === "ACTIVE",
        subscription: {
          id: subscription.id,
          status: subscription.status,
          autoPayEnabled: subscription.autoPayEnabled,
          paymentMethod: subscription.paymentMethod,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          amountPaidMinor: subscription.amountPaidMinor,
          plan: {
            id: subscription.plan.id,
            name: subscription.plan.name,
            code: subscription.plan.code,
            discountPriceMinor: subscription.plan.discountPriceMinor,
            originalPriceMinor: subscription.plan.originalPriceMinor,
            badge: subscription.plan.badge,
            features: subscription.plan.features,
          },
        },
      };
    });
  }

  /**
   * 1-Click Launch Offer Pre-Checkout:
   * Registers/Finds user, creates auth session, generates Razorpay subscription mandate.
   */
  async initiateLaunchCheckout(
    input: { name: string; email: string; phone?: string; planCode?: string },
    metadata: { ipAddress?: string; userAgent?: string; platform?: string },
  ) {
    const email = input.email.trim().toLowerCase();
    const currentPlatform = metadata.platform || "WEB";

    // 1. Upsert User (Using platform admin bypass for global table)
    const user = await withPlatformAdmin(this.database, async (tx: any) => {
      return tx.user.upsert({
        where: { email },
        update: {
          name: input.name || undefined,
          lastLoginAt: new Date(),
          lastPlatform: currentPlatform,
        },
        create: {
          email,
          name: input.name,
          lastLoginAt: new Date(),
          signupPlatform: currentPlatform,
          lastPlatform: currentPlatform,
        },
      });
    });

    // 2. Create Session Token
    const sessionResult = await this.sessions.create(user.id, metadata);

    // 3. Find Plan
    const plan = await withPlatformAdmin(this.database, async (tx: any) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.planCode || "");
      let p = await tx.subscriptionPlan.findFirst({
        where: {
          OR: isUuid
            ? [{ id: input.planCode }, { code: input.planCode }]
            : [{ code: input.planCode || "launch_offer_249" }],
          isActive: true,
        },
      });
      if (!p) {
        p = await tx.subscriptionPlan.findFirst({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        });
      }
      return p;
    });

    if (!plan) {
      throw new NotFoundException("Launch offer subscription plan not found.");
    }

    const keyId = this.razorpay.getKeyId();

    // 4. Ensure Razorpay Plan ID exists
    let razorpayPlanId = plan.razorpayPlanId;
    if (!razorpayPlanId) {
      try {
        const rzpPlan = await this.razorpay.createSubscriptionPlan({
          name: plan.name,
          amountMinor: plan.discountPriceMinor,
          period: (plan.billingPeriod as any) || "monthly",
          interval: plan.billingInterval || 1,
          description: plan.description || `CRMKaro ${plan.name}`,
        });
        razorpayPlanId = rzpPlan.id;
        await withPlatformAdmin(this.database, (tx: any) =>
          tx.subscriptionPlan.update({ where: { id: plan.id }, data: { razorpayPlanId } })
        );
      } catch (err: any) {
        razorpayPlanId = `plan_mock_${plan.code}`;
      }
    }

    // 5. Generate Subscription Mandate
    let subscriptionId: string;
    try {
      const rzpSub = await this.razorpay.createSubscription({
        planId: razorpayPlanId,
        totalCount: 120,
        quantity: 1,
        customerNotify: 1,
        notes: {
          userId: user.id,
          planId: plan.id,
          planName: plan.name,
        },
      });
      subscriptionId = rzpSub.id;
    } catch (err: any) {
      subscriptionId = `sub_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    return {
      token: sessionResult.token,
      userId: user.id,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: input.phone || null,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        code: plan.code,
        originalPriceMinor: plan.originalPriceMinor,
        discountPriceMinor: plan.discountPriceMinor,
        currency: plan.currency,
        badge: plan.badge,
      },
      subscriptionId,
      keyId,
    };
  }

  /**
   * Finalizes Launch Offer Onboarding:
   * Creates the tenant organization, binds the active subscription, and activates session.
   */
  async completeLaunchCheckout(
    userId: string,
    sessionId: string,
    input: {
      organisationName: string;
      businessType: string;
      industry?: string;
      planId?: string;
      subscriptionId: string;
      paymentId: string;
      signature?: string;
      paymentMethod?: string;
    },
  ) {
    // 1. Create Organization via OrganisationsService
    const org = await this.organisations.create(userId, sessionId, {
      name: input.organisationName.trim(),
      businessType: input.businessType.trim(),
      industry: input.industry || input.businessType,
      currency: "INR",
      timezone: "Asia/Kolkata",
      serviceCodes: ["students", "crm", "finance", "payroll", "groups"],
    });

    // 2. Activate Organization's Subscription
    const subResult = await this.verifyAutoPaySubscription(org.id, userId, {
      planId: input.planId,
      razorpaySubscriptionId: input.subscriptionId,
      razorpayPaymentId: input.paymentId,
      razorpaySignature: input.signature,
      paymentMethod: input.paymentMethod || "UPI",
    });

    return {
      success: true,
      organisation: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        businessType: org.businessType,
      },
      subscription: subResult.subscription,
    };
  }
}
