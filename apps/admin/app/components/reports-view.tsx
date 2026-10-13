"use client";

import { Icon, StatCard } from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

export type ReportsOverviewData = {
  totalUsers: number;
  webUsers: number;
  mobileUsers: number;
  totalOrganisations: number;
  activeOrganisations: number;
  totalGrossVolume: number;
  totalRefundedVolume: number;
  netVolume: number;
  successfulTransactionsCount: number;
  refundedCount: number;
};

type Props = {
  onFeedback: (msg: string, type: "success" | "error") => void;
};

function downloadCsv(filename: string, rows: string[][]) {
  const csvContent =
    "data:text/csv;charset=utf-8," +
    rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function ReportsView({ onFeedback }: Props) {
  const api = getApiUrl();
  const [data, setData] = useState<ReportsOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${api}/platform/reports/overview`);
      if (!res.ok) throw new Error("Failed to load reports overview");
      const json = await res.json();
      setData(json.metrics || null);
    } catch {
      onFeedback("Could not load reports data.", "error");
    } finally {
      setLoading(false);
    }
  }, [api, onFeedback]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Export Users CSV
  const handleExportUsers = async () => {
    setExporting("users");
    try {
      const res = await authFetch(`${api}/platform/users?limit=200`);
      if (!res.ok) throw new Error("Failed to load users for export");
      const json = await res.json();
      const users = json.users || [];

      const rows = [
        ["User ID", "Name", "Email", "Status", "First Platform", "Last Platform", "Verified", "Created At"],
        ...users.map((u: any) => [
          u.id,
          u.name,
          u.email,
          u.status,
          u.signupPlatform,
          u.lastPlatform,
          u.isVerified ? "YES" : "NO",
          u.createdAt,
        ]),
      ];

      downloadCsv(`crmkaro_users_${new Date().toISOString().slice(0, 10)}.csv`, rows);
      onFeedback("Users CSV exported successfully!", "success");
    } catch {
      onFeedback("Failed to export users CSV.", "error");
    } finally {
      setExporting(null);
    }
  };

  // Export Tenants CSV
  const handleExportTenants = async () => {
    setExporting("tenants");
    try {
      const res = await authFetch(`${api}/platform/organisations`);
      if (!res.ok) throw new Error("Failed to load organisations for export");
      const json = await res.json();
      const orgs = json.organisations || [];

      const rows = [
        ["Tenant ID", "Name", "Slug", "Business Type", "Status", "Members", "Created At"],
        ...orgs.map((o: any) => [
          o.id,
          o.name,
          o.slug,
          o.businessType,
          o.status,
          o.memberCount,
          o.createdAt,
        ]),
      ];

      downloadCsv(`crmkaro_tenants_${new Date().toISOString().slice(0, 10)}.csv`, rows);
      onFeedback("Tenants CSV exported successfully!", "success");
    } catch {
      onFeedback("Failed to export tenants CSV.", "error");
    } finally {
      setExporting(null);
    }
  };

  // Export Transactions CSV
  const handleExportTransactions = async () => {
    setExporting("transactions");
    try {
      const res = await authFetch(`${api}/platform/transactions?limit=200`);
      if (!res.ok) throw new Error("Failed to load transactions for export");
      const json = await res.json();
      const txs = json.transactions || [];

      const rows = [
        ["Transaction ID", "Workspace", "Customer", "Amount (INR)", "Payment Method", "Status", "Reference", "Paid At"],
        ...txs.map((t: any) => [
          t.id,
          t.organisationName,
          t.personName,
          t.amount,
          t.method,
          t.status,
          t.reference,
          t.paidAt,
        ]),
      ];

      downloadCsv(`crmkaro_transactions_${new Date().toISOString().slice(0, 10)}.csv`, rows);
      onFeedback("Transactions CSV exported successfully!", "success");
    } catch {
      onFeedback("Failed to export transactions CSV.", "error");
    } finally {
      setExporting(null);
    }
  };

  const webPct = data && data.totalUsers > 0 ? Math.round((data.webUsers / data.totalUsers) * 100) : 50;
  const mobilePct = 100 - webPct;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          background: "#ffffff",
          padding: "12px 16px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a" }}>
            Platform Business Reports & 1-Click Export Center
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#64748b" }}>
            Real-time multi-tenant telemetry, gross processing volumes, and direct spreadsheet exports.
          </p>
        </div>

        <button
          className="secondary-btn"
          onClick={() => window.print()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", fontSize: 11.5 }}
        >
          <Icon name="reports" size={13} />
          <span>Print Business Report</span>
        </button>
      </div>

      {/* Metrics Row */}
      {data && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <StatCard label="Gross Processing Volume" value={`₹${data.totalGrossVolume.toLocaleString()}`} icon="finance" />
          <StatCard label="Net Settled Volume" value={`₹${data.netVolume.toLocaleString()}`} icon="rupee" />
          <StatCard label="Total Workspaces" value={data.totalOrganisations} icon="building" />
          <StatCard label="Total Platform Users" value={data.totalUsers} icon="people" />
        </div>
      )}

      {/* Channel Distribution & Acquisition */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#ffffff", padding: "14px 16px", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13, marginBottom: 4 }}>
            User Acquisition: Web vs Mobile App
          </div>
          <p style={{ color: "#64748b", fontSize: 11.5, margin: "0 0 12px" }}>
            Breakdown of registered platform accounts based on where they first signed up.
          </p>

          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "#f1f5f9", marginBottom: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ width: `${webPct}%`, background: "#0284c7", transition: "width 0.3s" }} />
            <div style={{ width: `${mobilePct}%`, background: "#16a34a", transition: "width 0.3s" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#0284c7" }} />
              <span style={{ color: "#475569" }}>Web Portal: <strong>{data?.webUsers || 0} ({webPct}%)</strong></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#16a34a" }} />
              <span style={{ color: "#475569" }}>Mobile App: <strong>{data?.mobileUsers || 0} ({mobilePct}%)</strong></span>
            </div>
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "14px 16px", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13, marginBottom: 4 }}>
            Financial Settlement Health
          </div>
          <p style={{ color: "#64748b", fontSize: 11.5, margin: "0 0 12px" }}>
            Reconciliation of collected revenues versus refunded amounts platform-wide.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
              <div style={{ color: "#64748b", fontSize: 11 }}>Completed Invoices</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a", marginTop: 2 }}>
                {data?.successfulTransactionsCount || 0}
              </div>
            </div>
            <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
              <div style={{ color: "#64748b", fontSize: 11 }}>Refunded Invoices</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#9333ea", marginTop: 2 }}>
                {data?.refundedCount || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Export Center */}
      <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13, marginBottom: 2 }}>
          1-Click Data Exports (CSV & Excel Compatible)
        </div>
        <p style={{ color: "#64748b", fontSize: 11.5, margin: "0 0 14px" }}>
          Instantly download clean, unredacted reports in standard RFC-4180 CSV format.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 3, fontSize: 12.5 }}>Users Directory CSV</div>
            <div style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>
              Full list with emails, origin platforms (Web vs Mobile), and verification statuses.
            </div>
            <button
              className="primary-btn"
              onClick={handleExportUsers}
              disabled={exporting === "users"}
              style={{ width: "100%", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 11.5 }}
            >
              <Icon name="download" size={13} />
              <span>{exporting === "users" ? "Exporting…" : "Export Users CSV"}</span>
            </button>
          </div>

          <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 3, fontSize: 12.5 }}>Tenants & Workspaces CSV</div>
            <div style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>
              All registered schools, gyms, real estate agencies, and active service codes.
            </div>
            <button
              className="primary-btn"
              onClick={handleExportTenants}
              disabled={exporting === "tenants"}
              style={{ width: "100%", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 11.5 }}
            >
              <Icon name="download" size={13} />
              <span>{exporting === "tenants" ? "Exporting…" : "Export Tenants CSV"}</span>
            </button>
          </div>

          <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 3, fontSize: 12.5 }}>Platform Transactions CSV</div>
            <div style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>
              Cross-tenant payments, refunds, and gateway transaction references.
            </div>
            <button
              className="primary-btn"
              onClick={handleExportTransactions}
              disabled={exporting === "transactions"}
              style={{ width: "100%", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 11.5 }}
            >
              <Icon name="download" size={13} />
              <span>{exporting === "transactions" ? "Exporting…" : "Export Transactions CSV"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
