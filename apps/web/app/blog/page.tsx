import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRMKaro Blog & Guides — Business Growth, Fees & Payroll",
  description:
    "Guides and tutorials on how to streamline student fees collection, customer billing, lead tracking, and staff payroll with CRMKaro.",
};

export default function BlogPage() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif", color: "#1e293b", lineHeight: 1.6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <img src="/brand/crmkaro-mark.png" alt="CRMKaro" width={40} height={40} style={{ borderRadius: 8 }} />
        <h1 style={{ fontSize: 28, margin: 0, color: "#0f172a" }}>CRMKaro Guides & Insights</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 32 }}>
        <article style={{ background: "#ffffff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: 20, color: "#1e3a8a", marginTop: 0 }}>
            How to Streamline Student Fees Collection & Reduce Overdue Dues
          </h2>
          <p style={{ color: "#475569", fontSize: 15 }}>
            Learn how modern coaching institutes and academies automate 12-month billing sessions, track 2nd/3rd installment payments, and send instant WhatsApp receipts.
          </p>
          <span style={{ fontSize: 13, color: "#64748b" }}>Academic Management · 5 min read</span>
        </article>

        <article style={{ background: "#ffffff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: 20, color: "#1e3a8a", marginTop: 0 }}>
            The Complete Guide to Staff Salaries and Automated Payroll for Institutes
          </h2>
          <p style={{ color: "#475569", fontSize: 15 }}>
            Configure basic salaries, HRA, advance deductions, and generate professional PDF payslips with CRMKaro's unified payroll engine.
          </p>
          <span style={{ fontSize: 13, color: "#64748b" }}>HR & Payroll · 4 min read</span>
        </article>

        <article style={{ background: "#ffffff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: 20, color: "#1e3a8a", marginTop: 0 }}>
            Why Every Growing Business Needs Fast Lead CRM Pipelines
          </h2>
          <p style={{ color: "#475569", fontSize: 15 }}>
            Discover how zero-typing follow-up presets and visual Kanban pipelines increase conversion rates from inquiries to paid customers.
          </p>
          <span style={{ fontSize: 13, color: "#64748b" }}>Sales & CRM · 4 min read</span>
        </article>
      </div>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e2e8f0", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/login" style={{ background: "#2563eb", color: "#fff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          Sign In / Login
        </Link>
        <Link href="/register" style={{ background: "#059669", color: "#fff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          Create Account / Register
        </Link>
        <Link href="/features" style={{ background: "#f1f5f9", color: "#334155", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          View Features
        </Link>
      </div>
    </main>
  );
}
