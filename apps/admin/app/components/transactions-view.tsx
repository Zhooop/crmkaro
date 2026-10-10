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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Metric Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
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
          gap: 12,
          background: "#0f172a",
          padding: "16px 20px",
          borderRadius: 10,
          border: "1px solid #1e293b",
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#f8fafc" }}>
            Platform Payment Transactions & Refunds Hub
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Cross-tenant payment ledger across all Web checkout and Mobile in-app payment transactions.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Filter:</span>
          {(["ALL", "SUCCESS", "REFUNDED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: statusFilter === s ? "#38bdf8" : "#1e293b",
                color: statusFilter === s ? "#0f172a" : "#94a3b8",
              }}
            >
              {s === "ALL" ? "All" : s === "SUCCESS" ? "Successful" : "Refunded"}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No transactions found.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#1e293b", color: "#94a3b8", borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "12px 16px" }}>Workspace / Business</th>
                <th style={{ padding: "12px 16px" }}>Customer / Student</th>
                <th style={{ padding: "12px 16px" }}>Amount</th>
                <th style={{ padding: "12px 16px" }}>Payment Method</th>
                <th style={{ padding: "12px 16px" }}>Reference</th>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>{tx.organisationName}</div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>{tx.personName}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, color: tx.status === "REFUNDED" ? "#a855f7" : "#10b981" }}>
                      ₹{tx.amount.toLocaleString()}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge tone="neutral">{tx.method}</Badge>
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>
                    {tx.reference}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                    {new Date(tx.paidAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge tone={tx.status === "SUCCESS" ? "green" : tx.status === "REFUNDED" ? "purple" : "red"}>
                      {tx.status}
                    </Badge>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    {tx.status === "SUCCESS" ? (
                      <button
                        onClick={() => setSelectedTx(tx)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          background: "#4c1d95",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Refund
                      </button>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: 12 }}>Refunded</span>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: "#cbd5e1", fontSize: 13, margin: 0 }}>
              You are issuing a refund for payment <strong>{selectedTx.reference}</strong> from workspace <strong>{selectedTx.organisationName}</strong>.
            </p>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Reason for Refund:
              </label>
              <input
                type="text"
                placeholder="e.g. Overcharged, student dropped out, cancelled order"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                style={{
                  width: "100%",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
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
