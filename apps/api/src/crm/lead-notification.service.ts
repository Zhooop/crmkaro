import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { DatabaseClient } from "@crmkaro/database";
import { withPlatformAdmin } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import type { Environment } from "../config/environment.js";

function formatMoney(amountMinor: number | null | undefined, currency = "INR") {
  if (!amountMinor) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

@Injectable()
export class LeadNotificationService {
  private readonly logger = new Logger(LeadNotificationService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(DATABASE) private readonly database: DatabaseClient,
  ) {}

  private getTransporter() {
    const host = this.config.get("SMTP_HOST", { infer: true });
    const port = Number(this.config.get("SMTP_PORT", { infer: true })) || 587;
    const user = this.config.get("SMTP_USER", { infer: true });
    const password = this.config.get("SMTP_PASSWORD", { infer: true });
    const secure = this.config.get("SMTP_SECURE", { infer: true }) === "true";

    if (!host || !user || !password) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: password },
    });
  }

  async sendNewLeadAlert(organisationId: string, lead: {
    name: string;
    phone?: string | null;
    email?: string | null;
    source?: string | null;
    expectedValueMinor?: number | null;
    notes?: string | null;
  }) {
    try {
      const org = await withPlatformAdmin(this.database, async (tx) => {
        return tx.organisation.findUnique({
          where: { id: organisationId },
          include: { leadSetting: true },
        });
      });

      if (!org || !org.leadSetting) {
        this.logger.log(`No lead settings found for org ${organisationId}. Skipping email.`);
        return;
      }

      const { leadSetting } = org;
      if (!leadSetting.sendLeadEmailAlert || !leadSetting.notifyEmails) {
        return;
      }

      const recipients = leadSetting.notifyEmails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.includes("@"));

      if (recipients.length === 0) return;

      const webUrl = this.config.get("WEB_URL", { infer: true }) || "http://localhost:3000";
      const from = this.config.get("AUTH_EMAIL_FROM", { infer: true }) || "CRMKaro <leads@crmkaro.com>";

      const cleanPhone = lead.phone ? lead.phone.replace(/[^0-9]/g, "") : "";
      const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone}` : null;
      const telLink = lead.phone ? `tel:${lead.phone}` : null;
      const mailtoLink = lead.email ? `mailto:${lead.email}` : null;

      const isRealEstate = (org.businessType || org.industry || "").toLowerCase().includes("real");
      const isCoaching = (org.businessType || org.industry || "").toLowerCase().includes("tuition") ||
                         (org.businessType || org.industry || "").toLowerCase().includes("coach");

      const badgeLabel = isRealEstate ? "Property Deal Lead" : isCoaching ? "Admission Inquiry" : "New Sales Lead";
      const valueLabel = formatMoney(lead.expectedValueMinor);

      const subject = `🔥 [New Lead] ${lead.name} · ${valueLabel !== "₹0" ? valueLabel + " · " : ""}${lead.source || "Ad Campaign"}`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
    
    <!-- Brand Header -->
    <div style="background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%); padding: 24px 28px; color: #ffffff;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; background: rgba(255, 255, 255, 0.2); padding: 4px 10px; border-radius: 999px;">
          ${badgeLabel}
        </span>
        <span style="font-size: 12px; color: #dbeafe; font-weight: 600;">${org.name}</span>
      </div>
      <h1 style="margin: 14px 0 4px; font-size: 24px; font-weight: 800; color: #ffffff;">
        ${lead.name}
      </h1>
      <p style="margin: 0; font-size: 14px; color: #bfdbfe;">
        Source: <strong>${lead.source || "Website Ingestion / Ad"}</strong>
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 24px 28px;">
      
      <!-- Quick Action Buttons -->
      <div style="display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap;">
        ${telLink ? `
        <a href="${telLink}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 700;">
          📞 Call ${lead.phone}
        </a>` : ""}
        ${waLink ? `
        <a href="${waLink}" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 700;">
          💬 WhatsApp
        </a>` : ""}
        ${mailtoLink ? `
        <a href="${mailtoLink}" style="display: inline-block; background: #f1f5f9; color: #334155; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1;">
          ✉️ Send Email
        </a>` : ""}
      </div>

      <!-- Key Details Card -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 35%;">Customer Name</td>
          <td style="padding: 10px 0; font-size: 14px; color: #0f172a; font-weight: 700;">${lead.name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; font-size: 13px; color: #64748b; font-weight: 600;">Phone Number</td>
          <td style="padding: 10px 0; font-size: 14px; color: #0f172a; font-weight: 700;">${lead.phone || "—"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; font-size: 13px; color: #64748b; font-weight: 600;">Email Address</td>
          <td style="padding: 10px 0; font-size: 14px; color: #0f172a; font-weight: 700;">${lead.email || "—"}</td>
        </tr>
        ${lead.expectedValueMinor ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; font-size: 13px; color: #64748b; font-weight: 600;">Expected Deal Value</td>
          <td style="padding: 10px 0; font-size: 15px; color: #16a34a; font-weight: 800;">${valueLabel}</td>
        </tr>` : ""}
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; font-size: 13px; color: #64748b; font-weight: 600;">Campaign / Source</td>
          <td style="padding: 10px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${lead.source || "Direct"}</td>
        </tr>
        ${lead.notes ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; font-size: 13px; color: #64748b; font-weight: 600;">Inquiry Notes</td>
          <td style="padding: 10px 0; font-size: 13.5px; color: #334155;">${lead.notes}</td>
        </tr>` : ""}
        <tr>
          <td style="padding: 10px 0; font-size: 13px; color: #64748b; font-weight: 600;">Received At</td>
          <td style="padding: 10px 0; font-size: 13px; color: #64748b;">${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</td>
        </tr>
      </table>

      <!-- Open in CRM Button -->
      <div style="text-align: center; margin: 28px 0 12px;">
        <a href="${webUrl}/crm" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 999px; font-size: 14px; font-weight: 750; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);">
          Open in CRMKaro Pipeline →
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8;">
      This lead alert was automatically dispatched by CRMKaro for <strong>${org.name}</strong>.
    </div>
  </div>
</body>
</html>
      `;

      const transporter = this.getTransporter();
      if (!transporter) {
        this.logger.log(`[SIMULATED EMAIL ALERT] To: ${recipients.join(", ")} | Subject: ${subject}`);
        return;
      }

      await transporter.sendMail({
        from,
        to: recipients,
        subject,
        html,
      });

      this.logger.log(`✅ Lead alert email delivered to ${recipients.join(", ")} for org ${org.name}`);
    } catch (err: any) {
      this.logger.error(`Failed to send lead alert email: ${err.message}`, err.stack);
    }
  }

  async sendTestEmail(organisationId: string, testEmail: string, orgName: string) {
    const from = this.config.get("AUTH_EMAIL_FROM", { infer: true }) || "CRMKaro <onboarding@resend.dev>";
    const subject = `✅ CRMKaro Lead Alert Test — Connected Successfully for ${orgName}`;

    const recipients = (testEmail || "")
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes("@"));

    if (recipients.length === 0) {
      return { status: "failed", message: "Please provide a valid email address." };
    }

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #f8fafc; padding: 24px;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="font-size: 11px; font-weight: 800; color: #16a34a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
      ✓ Test Alert Successful
    </div>
    <h2 style="margin: 0 0 12px; color: #0f172a;">Your Email Alert System is Live!</h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
      This test confirms that <strong>${orgName}</strong> is configured to receive instant real-time lead alerts at <strong>${recipients.join(", ")}</strong> whenever a new lead is captured via Facebook Ads, Google Forms, or your website.
    </p>
    <div style="padding: 12px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; font-size: 12px; color: #1d4ed8;">
      ⚡ Average response time under 5 minutes increases conversion rates by up to 391%.
    </div>
  </div>
</body>
</html>
    `;

    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.log(`[SIMULATED TEST EMAIL] To: ${recipients.join(", ")} | Subject: ${subject}`);
      return { status: "simulated", message: `Test email simulated for ${recipients.join(", ")} (SMTP not configured)` };
    }

    try {
      await transporter.sendMail({
        from,
        to: recipients,
        subject,
        html,
      });

      this.logger.log(`✅ Test email delivered to ${recipients.join(", ")} for org ${orgName}`);
      return { status: "delivered", message: `Test alert email sent to ${recipients.join(", ")}! Check your inbox.` };
    } catch (err: any) {
      this.logger.error(`Failed to send test email: ${err.message}`, err.stack);
      return {
        status: "failed",
        message: `Delivery failed: ${err.message}. If using trial Resend/SMTP, ensure your recipient or domain is authorized.`,
      };
    }
  }
}
