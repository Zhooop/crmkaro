import { Inject, Injectable, Logger, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import crypto from "node:crypto";
import type { Environment } from "../config/environment.js";

export interface CreateOrderParams {
  amountMinor: number; // in paise (e.g. 50000 = ₹500.00)
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  getKeyId(): string {
    return this.config.get("RAZORPAY_KEY_ID", { infer: true }) || "rzp_test_TY2ZJ2xmygNaRc";
  }

  private getKeySecret(): string {
    return this.config.get("RAZORPAY_KEY_SECRET", { infer: true }) || "koWYk04AByMwVizQx12EuP84";
  }

  /**
   * Creates a Razorpay Order via REST API.
   */
  async createOrder(params: CreateOrderParams): Promise<RazorpayOrderResult> {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();

    if (!keyId || !keySecret) {
      throw new InternalServerErrorException("Razorpay credentials are not configured.");
    }

    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

    const bodyPayload = {
      amount: Math.round(params.amountMinor),
      currency: params.currency || "INR",
      receipt: params.receipt.slice(0, 40),
      notes: params.notes || {},
    };

    this.logger.log(`Creating Razorpay order for receipt ${params.receipt}, amount: ₹${params.amountMinor / 100}`);

    try {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        this.logger.error(`Razorpay order creation failed: ${JSON.stringify(data)}`);
        throw new BadRequestException(data.error?.description || "Failed to create Razorpay order.");
      }

      return {
        id: data.id,
        amount: data.amount,
        currency: data.currency,
        receipt: data.receipt,
        status: data.status,
      };
    } catch (err: any) {
      this.logger.error(`Error connecting to Razorpay: ${err.message}`, err.stack);
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException(`Razorpay network error: ${err.message}`);
    }
  }

  /**
   * Cryptographically verifies the payment signature using HMAC SHA-256.
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const keySecret = this.getKeySecret();
    if (!keySecret) return false;

    const payload = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    return generatedSignature === signature;
  }

  /**
   * Creates a Razorpay Subscription Plan via REST API (POST /v1/plans)
   */
  async createSubscriptionPlan(params: {
    name: string;
    amountMinor: number;
    period?: "monthly" | "yearly" | "daily" | "weekly";
    interval?: number;
    description?: string;
  }): Promise<{ id: string; period: string; interval: number }> {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();
    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

    const bodyPayload = {
      period: params.period || "monthly",
      interval: params.interval || 1,
      item: {
        name: params.name,
        amount: Math.round(params.amountMinor),
        currency: "INR",
        description: params.description || `${params.name} Subscription`,
      },
    };

    try {
      const response = await fetch("https://api.razorpay.com/v1/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        throw new BadRequestException(data.error?.description || "Failed to create Razorpay plan.");
      }

      return {
        id: data.id,
        period: data.period,
        interval: data.interval,
      };
    } catch (err: any) {
      this.logger.error(`Error creating Razorpay plan: ${err.message}`);
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException(`Razorpay plan creation error: ${err.message}`);
    }
  }

  /**
   * Creates a Razorpay Subscription for UPI AutoPay / Card Mandate (POST /v1/subscriptions)
   */
  async createSubscription(params: {
    planId: string;
    totalCount?: number;
    quantity?: number;
    customerNotify?: 0 | 1;
    notes?: Record<string, string>;
  }): Promise<{ id: string; status: string; planId: string }> {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();
    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

    const bodyPayload = {
      plan_id: params.planId,
      total_count: params.totalCount || 120, // 10 years / open ended
      quantity: params.quantity || 1,
      customer_notify: params.customerNotify !== undefined ? params.customerNotify : 1,
      notes: params.notes || {},
    };

    try {
      const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        throw new BadRequestException(data.error?.description || "Failed to create Razorpay subscription.");
      }

      return {
        id: data.id,
        status: data.status,
        planId: data.plan_id,
      };
    } catch (err: any) {
      this.logger.error(`Error creating Razorpay subscription: ${err.message}`);
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException(`Razorpay subscription error: ${err.message}`);
    }
  }

  /**
   * Cryptographically verifies the AutoPay subscription signature.
   * According to Razorpay docs: HMAC SHA-256 with payload `${paymentId}|${subscriptionId}`
   */
  verifySubscriptionSignature(subscriptionId: string, paymentId: string, signature: string): boolean {
    const keySecret = this.getKeySecret();
    if (!keySecret) return false;

    const payload = `${paymentId}|${subscriptionId}`;
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    return generatedSignature === signature;
  }
}
