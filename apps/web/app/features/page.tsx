import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRMKaro Features — Fees Collection, Lead CRM, GST Invoices & Payroll",
  description:
    "Explore all features of CRMKaro: Student Fees tracker, customer receipt generation, CRM lead management, employee payroll, expense tracking, and inventory.",
};

export default function FeaturesPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif", color: "#1e293b", lineHeight: 1.6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <img src="/brand/crmkaro-mark.png" alt="CRMKaro" width={40} height={40} style={{ borderRadius: 8 }} />
        <h1 style={{ fontSize: 28, margin: 0, color: "#0f172a" }}>CRMKaro Features & Capabilities</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, margin: "30px 0" }}>
        <div style={{ background: "#ffffff", padding: 24, borderRadius: 12, border: "1.5px solid #dbeafe", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 18, color: "#1e3a8a", marginTop: 0 }}>🎓 Student Fees & Month-Wise Billing</h3>
          <p style={{ color: "#475569", fontSize: 14 }}>
            1-Click 12-Month Academic Fee selection (April to March session), quarterly term billing, multi-time installment collection, and pending dues tracking.
          </p>
        </div>

        <div style={{ background: "#ffffff", padding: 24, borderRadius: 12, border: "1.5px solid #dbeafe", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 18, color: "#1e3a8a", marginTop: 0 }}>🧾 Send Receipts & GST Invoicing</h3>
          <p style={{ color: "#475569", fontSize: 14 }}>
            Direct PDF download and instant WhatsApp sharing with student name, month fees, and balance amount clearly formatted.
          </p>
        </div>

        <div style={{ background: "#ffffff", padding: 24, borderRadius: 12, border: "1.5px solid #dbeafe", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 18, color: "#1e3a8a", marginTop: 0 }}>📈 Collect Leads & Sales CRM</h3>
          <p style={{ color: "#475569", fontSize: 14 }}>
            Visual Kanban pipeline, inquiry stages, 1-click follow-up presets, call logs, and instant conversion to enrolled students or active clients.
          </p>
        </div>

        <div style={{ background: "#ffffff", padding: 24, borderRadius: 12, border: "1.5px solid #dbeafe", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 18, color: "#1e3a8a", marginTop: 0 }}>👥 Staff Salaries & Automated Payroll</h3>
          <p style={{ color: "#475569", fontSize: 14 }}>
            Unified 1-step staff enrollment with monthly salary structure, monthly payroll runs, salary slips, and disbursement tracking.
          </p>
        </div>

        <div style={{ background: "#ffffff", padding: 24, borderRadius: 12, border: "1.5px solid #dbeafe", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 18, color: "#1e3a8a", marginTop: 0 }}>💸 Kharcha (Expense Management)</h3>
          <p style={{ color: "#475569", fontSize: 14 }}>
            Log daily operating expenses (rent, electricity, tools, vendor bills) with instant category analytics and cashflow calculations.
          </p>
        </div>

        <div style={{ background: "#ffffff", padding: 24, borderRadius: 12, border: "1.5px solid #dbeafe", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 18, color: "#1e3a8a", marginTop: 0 }}>📦 Inventory & Stock Ledger</h3>
          <p style={{ color: "#475569", fontSize: 14 }}>
            Maintain product catalog, uniform and study kit stocks with low stock reorder alerts and audited movement logs.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e2e8f0", display: "flex", gap: 16 }}>
        <Link href="/login" style={{ background: "#2563eb", color: "#fff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          Launch Workspace
        </Link>
        <Link href="/about" style={{ background: "#f1f5f9", color: "#334155", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          About CRMKaro
        </Link>
      </div>
    </main>
  );
}
