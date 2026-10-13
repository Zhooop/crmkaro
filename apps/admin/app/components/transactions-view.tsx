"use client";

import { Badge, Icon, Modal, StatCard } from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

export type PlatformTransaction = {
  id: string;
  organisationId: string;
  organisationName: string;
  personName: string;
  amount: number;
  currency: string;
  method: string;
  status: "SUCCESS" | "REFUNDED" | "PARTIALLY_REFUNDED" | "FAILED";
  reference: string;
  paidAt: string;
  createdAt: string;
  refundCount: number;
};

type Props = {
  onFeedback: (msg: string, type: "success" | "error") => void;
};

export function TransactionsView({ onFeedback }: Props) {
  const api = getApiUrl();
  const [transactions, setTransactions] = useState<PlatformTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Refund Modal State
  const [selectedTx, setSelectedTx] = useState<PlatformTransaction | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [processingRefund, setProcessingRefund] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await authFetch(`${api}/platform/transactions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load transactions");
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch {
      onFeedback("Could not load transactions feed.", "error");
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter, onFeedback]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleProcessRefund = async () => {
    if (!selectedTx) return;
    setProcessingRefund(true);
    try {
      const res = await authFetch(`${api}/platform/transactions/${selectedTx.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason.trim() || "Refund approved by Platform Super Admin" }),
      });
      if (!res.ok) throw new Error("Failed to process refund");
      onFeedback(`Refund processed for ₹${selectedTx.amount.toLocaleString()}.`, "success");
      setSelectedTx(null);
      setRefundReason("");
      fetchTransactions();
    } catch {
      onFeedback("Could not issue refund.", "error");
    } finally {
      setProcessingRefund(false);
    }
  };

  const totalGross = transactions.reduce((acc, t) => acc + (t.status === "SUCCESS" ? t.amount : 0), 0);
  const totalRefunded = transactions.reduce((acc, t) => acc + (t.status === "REFUNDED" ? t.amount : 0), 0);
  const successCount = transactions.filter((t) => t.status === "SUCCESS").length;
  const refundCount = transactions.filter((t) => t.status === "REFUNDED").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Metric Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <StatCard label="Total Processed Volume" value={`₹${totalGross.toLocaleString()}`} icon="finance" />
        <StatCard label="Total Refunded Volume" value={`₹${totalRefunded.toLocaleString()}`} icon="rupee" />
        <StatCard label="Successful Transactions" value={successCount} icon="checkCircle" />
        <StatCard label="Refunds Issued" value={refundCount} icon="alertCircle" />
      </div>

      {/* Filter Bar */}
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
            Platform Payment Transactions & Refunds Hub
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#64748b" }}>
            Cross-tenant payment ledger across all Web checkout and Mobile in-app payment transactions.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Filter:</span>
          {(["ALL", "SUCCESS", "REFUNDED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 600,
                border: "1px solid " + (statusFilter === s ? "#0284c7" : "#e2e8f0"),
                cursor: "pointer",
                background: statusFilter === s ? "#0284c7" : "#ffffff",
                color: statusFilter === s ? "#ffffff" : "#475569",
              }}
            >
              {s === "ALL" ? "All" : s === "SUCCESS" ? "Successful" : "Refunded"}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>No transactions found.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <th style={{ padding: "10px 14px" }}>Workspace / Business</th>
                <th style={{ padding: "10px 14px" }}>Customer / Student</th>
                <th style={{ padding: "10px 14px" }}>Amount</th>
                <th style={{ padding: "10px 14px" }}>Payment Method</th>
                <th style={{ padding: "10px 14px" }}>Reference</th>
                <th style={{ padding: "10px 14px" }}>Date</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{tx.organisationName}</div>
                  </td>
                  <td style={{ padding: "9px 14px", color: "#475569" }}>{tx.personName}</td>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ fontWeight: 700, color: tx.status === "REFUNDED" ? "#9333ea" : "#16a34a" }}>
                      ₹{tx.amount.toLocaleString()}
                    </div>
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <Badge tone="neutral">{tx.method}</Badge>
                  </td>
                  <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>
                    {tx.reference}
                  </td>
                  <td style={{ padding: "9px 14px", color: "#475569" }}>
                    {new Date(tx.paidAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <Badge tone={tx.status === "SUCCESS" ? "green" : tx.status === "REFUNDED" ? "purple" : "red"}>
                      {tx.status}
                    </Badge>
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>
                    {tx.status === "SUCCESS" ? (
                      <button
                        onClick={() => setSelectedTx(tx)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 5,
                          fontSize: 11.5,
                          background: "#7c3aed",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Refund
                      </button>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: 11.5 }}>Refunded</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Refund Modal */}
      {selectedTx && (
        <Modal
          title={`Process Refund for ₹${selectedTx.amount.toLocaleString()}`}
          isOpen={Boolean(selectedTx)}
          onClose={() => setSelectedTx(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ color: "#475569", fontSize: 12, margin: 0, lineHeight: 1.4 }}>
              You are issuing a refund for payment <strong>{selectedTx.reference}</strong> from workspace <strong>{selectedTx.organisationName}</strong>.
            </p>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
                Reason for Refund:
              </label>
              <input
                type="text"
                placeholder="e.g. Overcharged, student dropped out, cancelled order"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  padding: "7px 10px",
                  color: "#0f172a",
                  fontSize: 12,
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button className="secondary-btn" onClick={() => setSelectedTx(null)}>
                Cancel
              </button>
              <button
                className="primary-btn"
                onClick={handleProcessRefund}
                disabled={processingRefund}
                style={{ background: "#7c3aed" }}
              >
                {processingRefund ? "Processing…" : "Confirm & Issue Refund"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
