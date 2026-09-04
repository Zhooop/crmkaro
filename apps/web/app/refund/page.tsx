import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy — CRMKaro by Zhoop",
  description:
    "Review the Cancellation and Refund Policy for CRMKaro subscriptions, including our 7-day satisfaction guarantee and refund processing timelines.",
};

export default function RefundPage() {
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
            CUSTOMER BILLING POLICY
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
            Cancellation & Refund Policy
          </h1>
          <p style={{ fontSize: 14.5, color: "#dbeafe", margin: 0, lineHeight: 1.6 }}>
            Last Updated: <strong>September 2026</strong> · 100% Transparent Customer Guarantee · Developed &
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
            Refund & Cancellation Policy
          </span>
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
              1. Our Transparent Billing Approach
            </h2>
            <p style={{ margin: 0 }}>
              At <strong>CRMKaro</strong> (a proprietary SaaS product operated by <strong>Zhoop InfoTech</strong>), we believe in delivering maximum value to educational academies, coaching institutes, studios, and Indian businesses with total billing clarity. This Cancellation and Refund Policy outlines your rights and our procedures regarding subscription management.
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
              2. 7-Day Money-Back Guarantee (First-Time Subscriptions)
            </h2>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.28)",
                padding: "20px 24px",
                borderRadius: 12,
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, color: "#ffffff", fontSize: 16 }}>
                If you purchase a paid CRMKaro subscription for the first time and find that the platform does not meet your business requirements, or if our support engineering team is unable to resolve a critical issue preventing your usage, you are entitled to a <strong>100% Full Refund</strong> within <strong>7 days</strong> of your initial payment.
              </p>
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
              3. Subscription Cancellation Policy
            </h2>
            <ul style={{ paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <li><strong>Cancel Anytime:</strong> You can cancel your paid plan anytime with 1 click directly in your dashboard under <strong>Settings &rarr; Billing</strong>, or by emailing us.</li>
              <li><strong>Zero Penalties:</strong> There are no cancellation fees, hidden exit charges, or lock-in periods.</li>
              <li><strong>Active Until End of Cycle:</strong> Following cancellation, your paid workspace remains fully accessible until the conclusion of your current paid billing period. You will never be billed again.</li>
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
              4. Refund Processing Time & Payment Method
            </h2>
            <p>
              Once a refund is approved by our billing team:
            </p>
            <ul style={{ paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <li>Refunds are credited directly to your original payment source (Bank Account, UPI, Card via Razorpay/Cashfree).</li>
              <li>Per standard Indian banking regulations, the refunded amount typically reflects in your statement within <strong>5 to 7 business days</strong>.</li>
              <li>You will receive an official payment gateway ARN / UTR reference number for easy bank tracking.</li>
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
              5. Billing Help & Refund Requests
            </h2>
            <p style={{ margin: "0 0 14px", color: "#dbeafe" }}>
              To request a refund or inquire about a billing item, reach out to our team with your Registered Business Email:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 15 }}>
              <div><strong>Billing Entity:</strong> Zhoop InfoTech (CRMKaro)</div>
              <div><strong>Website:</strong> <a href="https://zhoop.in/" target="_blank" rel="noopener noreferrer" style={{ color: "#ffffff", textDecoration: "underline", fontWeight: 700 }}>https://zhoop.in/</a></div>
              <div><strong>Billing Support:</strong> <a href="mailto:billing@crmkaro.com" style={{ color: "#ffffff", textDecoration: "underline" }}>billing@crmkaro.com</a> / <a href="mailto:support@crmkaro.com" style={{ color: "#ffffff", textDecoration: "underline" }}>support@crmkaro.com</a></div>
              <div><strong>WhatsApp Billing Support:</strong> <a href="https://wa.me/919004520400" target="_blank" rel="noopener noreferrer" style={{ color: "#ffffff", textDecoration: "underline" }}>+91 90045 20400</a></div>
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
