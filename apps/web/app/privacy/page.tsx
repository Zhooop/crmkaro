import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — CRMKaro by Zhoop",
  description:
    "Learn how CRMKaro collects, encrypts, and protects your business, student, and customer data in accordance with DPDP Act 2023 and Indian IT laws.",
};

export default function PrivacyPage() {
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
            DATA PRIVACY & SECURITY
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
            Privacy Policy
          </h1>
          <p style={{ fontSize: 14.5, color: "#dbeafe", margin: 0, lineHeight: 1.6 }}>
            Last Updated: <strong>September 2026</strong> · Compliant with <strong>DPDP Act 2023 & IT Act 2000</strong> · Developed &
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
          <Link
            href="/terms"
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
            Terms & Conditions
          </Link>
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
            Privacy Policy
          </span>
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
              1. Our Privacy Commitment
            </h2>
            <p style={{ margin: 0 }}>
              At <strong>CRMKaro</strong> (a proprietary product of <strong>Zhoop InfoTech</strong>, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), we take the privacy and confidentiality of your business and personal records with utmost seriousness. This Privacy Policy details how we collect, process, store, encrypt, and protect data when you visit <a href="https://crmkaro.com" style={{ color: "#ffffff", textDecoration: "underline" }}>crmkaro.com</a>, use our web application, or connect your customer lead funnels.
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
              2. Information We Collect
            </h2>
            <p>We process information under two clear classifications:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 18, borderRadius: 12, borderLeft: "4px solid #ffffff" }}>
                <strong style={{ color: "#ffffff", fontSize: 16 }}>A. Account & Workspace Profile (Data Controller):</strong>
                <p style={{ margin: "6px 0 0", fontSize: 14.5 }}>
                  When you sign up or create an organisation workspace, we collect your full name, official email, phone number, business category, and billing credentials.
                </p>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 18, borderRadius: 12, borderLeft: "4px solid #67e8f9" }}>
                <strong style={{ color: "#67e8f9", fontSize: 16 }}>B. Business Operational Data (Data Processor):</strong>
                <p style={{ margin: "6px 0 0", fontSize: 14.5 }}>
                  Records managed by you on behalf of your students, customers, employees, and leads (e.g. Student fee ledger balances, batch attendance, leads captured from Facebook Ads via webhook, staff salary structures). You own 100% of this data; we process it strictly to fulfill platform operations.
                </p>
              </div>
            </div>
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
              3. Strict Tenant Row-Level Security (RLS)
            </h2>
            <p style={{ margin: 0 }}>
              CRMKaro enforces <strong>PostgreSQL Row-Level Security (RLS)</strong> directly on database tables. Every query executed by the application requires a verified cryptographic organization ID context. It is architecturally impossible for one organization to access, view, or query another tenant&rsquo;s student lists, leads, or invoices.
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
              4. Zero Data-Selling Guarantee
            </h2>
            <p style={{ margin: 0 }}>
              We <strong>NEVER</strong> sell, rent, monetize, or disclose your business contacts, student rosters, parent phone numbers, or lead lists to third-party data brokers, ad networks, or competitors. Your business records remain exclusively yours.
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
              5. Your Rights Under the DPDP Act 2023
            </h2>
            <p>
              In full compliance with India&rsquo;s Digital Personal Data Protection Act, 2023:
            </p>
            <ul style={{ paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <li><strong>Right to Export:</strong> Export your leads, fee registers, and invoice records to CSV and PDF formats anytime.</li>
              <li><strong>Right to Correction:</strong> Update student, customer, or employee records directly in the portal.</li>
              <li><strong>Right to Erasure:</strong> Request permanent deletion of your organization and all database records upon account closure.</li>
            </ul>
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
              6. Data Protection & Grievance Contact
            </h2>
            <p style={{ margin: "0 0 14px", color: "#dbeafe" }}>
              To exercise your data rights or speak with our Data Protection Officer:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 15 }}>
              <div><strong>Parent Company:</strong> Zhoop InfoTech (CRMKaro)</div>
              <div><strong>Website:</strong> <a href="https://zhoop.in/" target="_blank" rel="noopener noreferrer" style={{ color: "#ffffff", textDecoration: "underline", fontWeight: 700 }}>https://zhoop.in/</a></div>
              <div><strong>Privacy Desk:</strong> <a href="mailto:privacy@crmkaro.com" style={{ color: "#ffffff", textDecoration: "underline" }}>privacy@crmkaro.com</a> / <a href="mailto:zhoopinfotech@gmail.com" style={{ color: "#ffffff", textDecoration: "underline" }}>zhoopinfotech@gmail.com</a></div>
              <div><strong>WhatsApp Support:</strong> <a href="https://wa.me/919004520400" target="_blank" rel="noopener noreferrer" style={{ color: "#ffffff", textDecoration: "underline" }}>+91 90045 20400</a></div>
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
