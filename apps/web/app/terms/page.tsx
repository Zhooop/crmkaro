import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions — CRMKaro by Zhoop",
  description:
    "Read the Terms and Conditions for using CRMKaro, the modern Business Operating System developed by Zhoop.",
};

export default function TermsPage() {
  return (
    <div
      style={{
        background: "linear-gradient(160deg, #1d4ed8 0%, #2563eb 40%, #1e40af 80%, #173693 100%)",
        minHeight: "100vh",
        color: "#ffffff",
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Top Glass Navigation */}
      <header
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.18)",
          background: "rgba(23, 54, 147, 0.65)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img
              src="/brand/crmkaro-mark.png"
              alt="CRMKaro"
              width={34}
              height={34}
              style={{ borderRadius: 9, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
            />
            <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>CRMKaro</span>
            <span
              style={{
                fontSize: 11,
                padding: "3px 9px",
                background: "rgba(255, 255, 255, 0.18)",
                color: "#ffffff",
                borderRadius: 20,
                fontWeight: 700,
                border: "1px solid rgba(255, 255, 255, 0.35)",
              }}
            >
              by Zhoop
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link
              href="/"
              style={{
                fontSize: 14,
                color: "#dbeafe",
                textDecoration: "none",
                fontWeight: 600,
                transition: "color 0.2s",
              }}
            >
              ← Back to Home
            </Link>
            <Link
              href="/login"
              style={{
                fontSize: 14,
                color: "#1e40af",
                background: "#ffffff",
                padding: "8px 18px",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 700,
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
              }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 940, margin: "0 auto", padding: "48px 20px 80px" }}>
        {/* Document Header Card */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.10)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(255, 255, 255, 0.22)",
            borderRadius: 20,
            padding: "32px 36px",
            marginBottom: 32,
            boxShadow: "0 20px 50px -10px rgba(10, 25, 75, 0.3)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 14px",
              background: "rgba(255, 255, 255, 0.18)",
              color: "#ffffff",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.05em",
              marginBottom: 16,
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            LEGAL AGREEMENT
          </div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#ffffff",
              margin: "0 0 12px",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
          >
            Terms & Conditions of Service
          </h1>
          <p style={{ fontSize: 14.5, color: "#dbeafe", margin: 0, lineHeight: 1.6 }}>
            Last Updated: <strong>September 2026</strong> · Effective Date: <strong>January 1, 2026</strong> · Developed &
            Operated by{" "}
            <a
              href="https://zhoop.in/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#ffffff", textDecoration: "underline", fontWeight: 700 }}
            >
              Zhoop InfoTech (https://zhoop.in/)
            </a>
          </p>
        </div>

        {/* Quick Tabs to other policies */}
        <div style={{ display: "flex", gap: 10, marginBottom: 32, flexWrap: "wrap" }}>
          <span
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              background: "#ffffff",
              color: "#1e40af",
              fontSize: 13.5,
              fontWeight: 800,
              boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
            }}
          >
            Terms & Conditions
          </span>
          <Link
            href="/privacy"
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid rgba(255, 255, 255, 0.22)",
              backdropFilter: "blur(8px)",
            }}
          >
            Privacy Policy
          </Link>
          <Link
            href="/refund"
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid rgba(255, 255, 255, 0.22)",
              backdropFilter: "blur(8px)",
            }}
          >
            Refund & Cancellation Policy
          </Link>
        </div>

        {/* Legal Text Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, fontSize: 15.5, lineHeight: 1.7, color: "#dbeafe" }}>
          <section
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              padding: "26px 30px",
              borderRadius: 16,
            }}
          >
            <h2 style={{ fontSize: 21, fontWeight: 800, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
              1. Acceptance of Terms
            </h2>
            <p style={{ margin: 0 }}>
              Welcome to <strong>CRMKaro</strong> (&ldquo;Service&rdquo;, &ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), owned and operated by <strong>Zhoop InfoTech</strong> (&ldquo;Zhoop&rdquo;), accessible via <a href="https://crmkaro.com" style={{ color: "#ffffff", textDecoration: "underline" }}>crmkaro.com</a>, <a href="https://web.crmkaro.com" style={{ color: "#ffffff", textDecoration: "underline" }}>web.crmkaro.com</a>, and <a href="https://zhoop.in" style={{ color: "#ffffff", textDecoration: "underline" }}>zhoop.in</a>. By creating an account, accessing, or using CRMKaro, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions.
            </p>
          </section>

          <section
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              padding: "26px 30px",
              borderRadius: 16,
            }}
          >
            <h2 style={{ fontSize: 21, fontWeight: 800, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
              2. Description of Services & SaaS Platform
            </h2>
            <p>
              CRMKaro is an all-in-one cloud Business Operating System (BOS) engineered for Indian educational academies, tuition coaching centers, fitness studios, agencies, and small & medium enterprises (SMBs). The modular platform includes:
            </p>
            <ul style={{ paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <li><strong>Student & Batch Management:</strong> Academic session fee tracking, installment collections, batch attendance, and dues alerts.</li>
              <li><strong>Invoicing & WhatsApp Receipts:</strong> Instant digital receipt generation, PDF downloads, and 1-click WhatsApp transaction delivery.</li>
              <li><strong>Sales CRM & In-House Lead Capture:</strong> Visual CRM Kanban board, automated inbound webhooks for Meta (Facebook/Instagram) Lead Ads & website forms, and instant email alerts.</li>
              <li><strong>Staff Payroll & HR:</strong> Employee profiles, monthly salary structures, payroll approval runs, and automated payslip generation.</li>
              <li><strong>Kharcha (Expenses) & Inventory:</strong> Real-time operational expense ledgers, product catalog, and material movement tracking.</li>
            </ul>
          </section>

          <section
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              padding: "26px 30px",
              borderRadius: 16,
            }}
          >
            <h2 style={{ fontSize: 21, fontWeight: 800, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
              3. Account Registration & Row-Level Security (RLS)
            </h2>
            <p>
              You agree to provide accurate, current, and complete information during registration and keep your account credentials secure. You are responsible for all activities occurring under your workspace.
            </p>
            <p style={{ margin: 0 }}>
              CRMKaro enforces <strong>PostgreSQL Row-Level Security (RLS)</strong> directly at the database layer. Your organization&rsquo;s student rosters, fee payments, customer leads, and accounting records are completely isolated cryptographically from all other tenants on the platform.
            </p>
          </section>

          <section
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              padding: "26px 30px",
              borderRadius: 16,
            }}
          >
            <h2 style={{ fontSize: 21, fontWeight: 800, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
              4. Subscription, Billing & Taxes
            </h2>
            <p>
              CRMKaro is offered under tiered monthly and annual subscription plans. All subscription fees are billed in Indian Rupees (INR) or your designated currency in advance.
            </p>
            <ul style={{ paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <li><strong>Payment Processing:</strong> Transactions are handled securely via PCI-DSS certified payment gateways (Razorpay, Cashfree, UPI, Netbanking, Cards).</li>
              <li><strong>Taxes:</strong> Fees are exclusive of applicable Goods and Services Tax (GST), which will be itemized at checkout where required.</li>
              <li><strong>Renewal:</strong> Subscriptions renew automatically at the end of each billing cycle unless cancelled by you prior to the renewal date.</li>
            </ul>
          </section>

          <section
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              padding: "26px 30px",
              borderRadius: 16,
            }}
          >
            <h2 style={{ fontSize: 21, fontWeight: 800, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
              5. Customer Data Ownership & Intellectual Property
            </h2>
            <p>
              <strong>Your Data:</strong> You retain 100% full ownership of all data, customer files, student fee records, and lead details uploaded to your CRMKaro workspace. We do not claim any intellectual property rights over your business records.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Platform Property:</strong> The CRMKaro BOS platform, codebase, brand marks, and visual designs are the proprietary intellectual property of Zhoop InfoTech.
            </p>
          </section>

          <section
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              padding: "26px 30px",
              borderRadius: 16,
            }}
          >
            <h2 style={{ fontSize: 21, fontWeight: 800, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
              6. Governing Law & Dispute Resolution
            </h2>
            <p style={{ margin: 0 }}>
              These Terms and Conditions shall be governed by and interpreted in accordance with the laws of the <strong>Republic of India</strong>, including the Information Technology Act, 2000 and the Digital Personal Data Protection (DPDP) Act, 2023. Any dispute arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts in India.
            </p>
          </section>

          {/* Contact Box */}
          <section
            style={{
              background: "rgba(255, 255, 255, 0.14)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              padding: "28px 32px",
              borderRadius: 18,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
              7. Legal & Grievance Contact
            </h2>
            <p style={{ margin: "0 0 14px", color: "#dbeafe" }}>
              For legal inquiries, compliance questions, or formal notices regarding CRMKaro:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 15 }}>
              <div><strong>Parent Company:</strong> Zhoop InfoTech (CRMKaro)</div>
              <div><strong>Website:</strong> <a href="https://zhoop.in/" target="_blank" rel="noopener noreferrer" style={{ color: "#ffffff", textDecoration: "underline", fontWeight: 700 }}>https://zhoop.in/</a></div>
              <div><strong>Support Email:</strong> <a href="mailto:support@crmkaro.com" style={{ color: "#ffffff", textDecoration: "underline" }}>support@crmkaro.com</a> / <a href="mailto:zhoopinfotech@gmail.com" style={{ color: "#ffffff", textDecoration: "underline" }}>zhoopinfotech@gmail.com</a></div>
              <div><strong>WhatsApp Helpline:</strong> <a href="https://wa.me/919004520400" target="_blank" rel="noopener noreferrer" style={{ color: "#ffffff", textDecoration: "underline" }}>+91 90045 20400</a></div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.15)",
          background: "rgba(10, 25, 75, 0.4)",
          padding: "36px 20px",
          textAlign: "center",
          fontSize: 14,
          color: "#bfdbfe",
        }}
      >
        <p style={{ margin: "0 0 10px" }}>
          © {new Date().getFullYear()} CRMKaro Inc. · A Product by{" "}
          <a
            href="https://zhoop.in/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#ffffff", textDecoration: "underline", fontWeight: 800 }}
          >
            Zhoop
          </a>
          . All rights reserved.
        </p>
        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          <Link href="/terms" style={{ color: "#ffffff", textDecoration: "none", fontWeight: 600 }}>
            Terms of Service
          </Link>
          <span>·</span>
          <Link href="/privacy" style={{ color: "#ffffff", textDecoration: "none", fontWeight: 600 }}>
            Privacy Policy
          </Link>
          <span>·</span>
          <Link href="/refund" style={{ color: "#ffffff", textDecoration: "none", fontWeight: 600 }}>
            Refund Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
