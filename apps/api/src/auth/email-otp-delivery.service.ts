import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Environment } from "../config/environment.js";

@Injectable()
export class EmailOtpDeliveryService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<Environment, true>) {}

  async deliver(email: string, code: string): Promise<"delivered" | "development"> {
    const host = this.config.get("SMTP_HOST", { infer: true });
    const port = this.config.get("SMTP_PORT", { infer: true });
    const from = this.config.get("AUTH_EMAIL_FROM", { infer: true });

    if (!host || !port || !from) {
      if (this.config.get("NODE_ENV", { infer: true }) !== "production") return "development";
      throw new ServiceUnavailableException("Email authentication is temporarily unavailable.");
    }

    const user = this.config.get("SMTP_USER", { infer: true });
    const password = this.config.get("SMTP_PASSWORD", { infer: true });
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: this.config.get("SMTP_SECURE", { infer: true }) === "true",
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });

    await transport.sendMail({
      from,
      to: email,
      subject: "Your CRMKaro verification code",
      text: `Your CRMKaro verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your CRMKaro verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 10 minutes.</p>`,
    });

    return "delivered";
  }
}
