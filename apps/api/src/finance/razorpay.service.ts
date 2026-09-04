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
}
