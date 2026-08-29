import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About CRMKaro — Modern Business Operating System",
  description:
    "Learn how CRMKaro helps institutes, academies, agencies, and small businesses manage student fees, send receipts, track leads, and disburse staff salaries.",
};

export default function AboutPage() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif", color: "#1e293b", lineHeight: 1.6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <img src="/brand/crmkaro-mark.png" alt="CRMKaro" width={40} height={40} style={{ borderRadius: 8 }} />
        <h1 style={{ fontSize: 28, margin: 0, color: "#0f172a" }}>About CRMKaro</h1>
      </div>

      <p style={{ fontSize: 18, color: "#334155" }}>
        <strong>CRMKaro</strong> is a unified, high-performance Business Operating System (BOS) specifically engineered for coaching institutes, tuition academies, training centers, creative agencies, and growing Indian enterprises.
      </p>

      <section style={{ margin: "32px 0", background: "#f8fafc", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <h2 style={{ fontSize: 20, marginTop: 0, color: "#1e3a8a" }}>Core Pillars & Capabilities</h2>
        <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <li>
            <strong>Keep Fees Collection:</strong> Complete month-wise student fees tracker (April to March academic session), 1-click installment collection, and real-time dues tracking.
          </li>
          <li>
            <strong>Send Receipts to Customers:</strong> Instant PDF download and 1-click WhatsApp bill sharing with complete student, fee period, and balance details.
          </li>
          <li>
            <strong>Collect & Convert Leads:</strong> Visual CRM Kanban board, inquiry stage tracking, automated follow-up reminders, and 1-click lead-to-customer conversion.
          </li>
          <li>
            <strong>Staff Salaries & Payroll:</strong> Employee monthly salary packages, salary slips, monthly payroll batch approvals, and disbursement tracking.
          </li>
          <li>
            <strong>Kharcha (Business Expenses):</strong> Real-time operating expense recording, vendor categorization, and profit/loss overview.
          </li>
          <li>
            <strong>Inventory & Stock Ledger:</strong> Study material and course kit inventory with low-stock alerts and movement logs.
          </li>
        </ul>
      </section>

      <section style={{ margin: "32px 0" }}>
        <h2 style={{ fontSize: 20, color: "#0f172a" }}>Enterprise Security & Architecture</h2>
        <p>
          CRMKaro is built with PostgreSQL Row-Level Security (RLS) ensuring total multi-tenant data isolation, append-only immutable audit logs, and 256-bit encrypted HTTP-only session management.
        </p>
      </section>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e2e8f0", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/login" style={{ background: "#2563eb", color: "#fff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          Sign In / Login
        </Link>
        <Link href="/register" style={{ background: "#059669", color: "#fff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          Create Account / Register
        </Link>
        <Link href="/" style={{ background: "#f1f5f9", color: "#334155", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
