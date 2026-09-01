"use client";

import {
  AppShell,
  Badge,
  Icon,
  Modal,
  Tabs,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import {
  buildNavItems,
  useWorkspaceContext,
  DEFAULT_SERVICE_CODES,
  getCachedWorkspaceContext,
  saveCachedWorkspaceContext,
  saveActiveServicesToStorage,
} from "@/lib/nav";

type InvoiceItem = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
  subtotalMinor?: number;
  discountMinor?: number;
  taxMinor?: number;
  grandTotalMinor: number;
  balanceDueMinor: number;
  balanceMinor?: number;
  paidAmountMinor?: number;
  personId: string;
  notes?: string | null;
  createdAt: string;
  person?: {
    id: string;
    displayName: string;
    primaryPhone?: string | null;
    email?: string | null;
  };
  payments?: Array<{
    id: string;
    receiptNumber: string;
    amountMinor: number;
    method: string;
    paidAt: string;
  }>;
};

function formatCurrency(minor: number | undefined, currency = "INR"): string {
  if (!minor) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function formatMoney(minor: number | undefined) {
  return formatCurrency(minor, "INR");
}

function TransactionsContent() {
  const router = useRouter();
  const api = getApiUrl();

  // Instant Cached AppShell Context (0ms delay)
  const { context: cached, isMounted, nav: defaultNav } = useWorkspaceContext();
  const [orgName, setOrgName] = useState("CRMKaro Workspace");
  const [userName, setUserName] = useState("Workspace User");
  const [userRole, setUserRole] = useState("Owner");
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);
  const [activeServiceCodes, setActiveServiceCodes] = useState<string[]>(DEFAULT_SERVICE_CODES);

  useEffect(() => {
    if (isMounted) {
      setOrgName(cached.orgName);
      setUserName(cached.userName);
      setUserRole(cached.userRole);
      setActiveServiceCodes(cached.activeServices);
    }
  }, [isMounted, cached]);

  // Tabs: "recent" | "paid" | "pending" | "partially-paid" (Screenshot 1)
  const [activeTab, setActiveTab] = useState<string>("recent");

  // Search & Filter (Screenshot 1)
  const [searchField, setSearchField] = useState<"customer" | "invoice" | "phone">("customer");
  const [searchQuery, setSearchQuery] = useState("");

  // Data States
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Receipt Modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);

  // Record Payment Modal
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Load Session Context
  const loadContext = useCallback(async () => {
    try {
      const meRes = await authFetch(`${api}/auth/me`, { credentials: "include" });
      if (meRes.status === 401) {
        router.replace("/login");
        return;
      }
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user?.name) {
          setUserName(meData.user.name);
          saveCachedWorkspaceContext({ userName: meData.user.name });
        }
      }
      const orgsRes = await authFetch(`${api}/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgList = await orgsRes.json();
        const activeOrgEntry = orgList.find(
          (o: { organisation: { id: string; name: string } | null; role: { name: string } }) =>
            o.organisation,
        );
        if (activeOrgEntry?.organisation) {
          const oName = activeOrgEntry.organisation.name;
          const rName = activeOrgEntry.role?.name || "Member";
          const srvs = activeOrgEntry.activeServices || activeOrgEntry.organisation.activeServices || [];
          setOrgName(oName);
          setUserRole(rName);
          if (srvs && Array.isArray(srvs)) {
            setActiveServiceCodes(srvs);
            saveCachedWorkspaceContext({ orgName: oName, userRole: rName, activeServices: srvs });
          }
        }
        setOrganisations(
          orgList
            .map((o: { organisation: { id: string; name: string; businessType?: string } }) => o.organisation)
            .filter(Boolean),
        );
      }
    } catch {
      // ignore
    }
  }, [api, router]);

  // Load Transactions / Invoices
  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${api}/finance/invoices?limit=100`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load transactions.");
      const data = await res.json();
      setInvoices(data.items || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadContext();
    loadInvoices();
  }, [loadContext, loadInvoices]);

  // Record Payment Handler
  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    if (!paymentModalInvoice || paymentAmount <= 0) return;
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const res = await authFetch(`${api}/finance/payments`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invoiceId: paymentModalInvoice.id,
          personId: paymentModalInvoice.personId,
          amountMinor: Math.round(paymentAmount * 100),
          method: paymentMethod,
          reference: paymentRef.trim() || undefined,
          receivedAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to record payment.");
      }

      setPaymentModalInvoice(null);
      setPaymentAmount(0);
      setPaymentRef("");
      setPaymentError("");
      loadInvoices();
    } catch (err) {
      setPaymentError((err as Error).message);
    } finally {
      setPaymentBusy(false);
    }
  }

  // Filter invoices according to selected tab and search query
  const filteredInvoices = invoices.filter((inv) => {
    // 1. Tab Status Filter
    if (activeTab === "paid" && inv.status !== "PAID") return false;
    if (activeTab === "pending" && !["ISSUED", "DRAFT"].includes(inv.status)) return false;
    if (activeTab === "partially-paid" && inv.status !== "PARTIALLY_PAID") return false;

    // 2. Search Filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    if (searchField === "customer") {
      return inv.person?.displayName?.toLowerCase().includes(q) ?? false;
    }
    if (searchField === "invoice") {
      return inv.invoiceNumber.toLowerCase().includes(q);
    }
    if (searchField === "phone") {
      return inv.person?.primaryPhone?.includes(q) ?? false;
    }
    return true;
  });

  const navItems: NavItem[] = isMounted ? buildNavItems(activeServiceCodes) : defaultNav;

  return (
    <AppShell
      product="CRMKaro"
      organisation={isMounted ? orgName : "CRMKaro Workspace"}
      organisations={organisations}
      currentPath="/transactions"
      nav={navItems}
      userName={isMounted ? userName : "Workspace User"}
      userRole={isMounted ? userRole : "Owner"}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
      onPrefetch={(href) => router.prefetch(href)}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Page Title (Screenshot 1) */}
        <div>
          <p className="eyebrow" style={{ color: "#059669" }}>
            <Icon name="transactions" size={14} /> Ledger & Payments
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "var(--ink)" }}>
            Transactions
          </h1>
        </div>

        {/* Horizontal Segmented Tabs (Screenshot 1) */}
        <div style={{ borderBottom: "1px solid var(--line)", marginTop: -4 }}>
          <Tabs
            items={[
              { id: "recent", label: "Recent" },
              { id: "paid", label: "Paid" },
              { id: "pending", label: "Pending" },
              { id: "partially-paid", label: "Partially Paid" },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Search & Filter Toolbar (Screenshot 1) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid var(--line)",
              borderRadius: 10,
              background: "#ffffff",
              overflow: "hidden",
              maxWidth: 440,
              width: "100%",
            }}
          >
            {/* Search Filter Dropdown */}
            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value as any)}
              style={{
                padding: "9px 12px",
                background: "#f8fafc",
                border: "none",
                borderRight: "1px solid var(--line)",
                fontSize: 13,
                fontWeight: 650,
                color: "var(--ink)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="customer">Customer Name</option>
              <option value="invoice">Invoice Number</option>
              <option value="phone">Mobile No</option>
            </select>

            {/* Search Input */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", flex: 1 }}>
              <Icon name="search" size={15} />
              <input
                type="text"
                placeholder={`Search ${searchField === "customer" ? "Customer Name" : searchField === "invoice" ? "Invoice #" : "Mobile No"}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  padding: "9px 0",
                  width: "100%",
                  fontSize: 13,
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setSearchQuery("")}
                  style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
                >
                  <Icon name="close" size={13} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchQuery("");
                loadInvoices();
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="filter" size={14} />
              <span>Filter</span>
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => router.push("/quick-collect")}
              style={{ background: "#059669", borderColor: "#059669", fontWeight: 700 }}
            >
              <Icon name="zap" size={14} />
              <span>+ Quick Collect</span>
            </button>
          </div>
        </div>

        {/* Content Table or Cute Empty State (Screenshot 1) */}
        {loading ? (
          <div className="empty-state" style={{ minHeight: 280 }}>
            <div className="state-spinner" />
            <p>Loading transactions…</p>
          </div>
        ) : error ? (
          <div className="empty-state" style={{ minHeight: 280 }}>
            <Icon name="alertCircle" size={28} />
            <h3>Error Loading Transactions</h3>
            <p>{error}</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          /* Cute Sleeping Wallet Empty State matching Screenshot 1 */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "70px 20px",
              background: "#ffffff",
              borderRadius: 14,
              border: "1px solid var(--line)",
              textAlign: "center",
            }}
          >
            <div style={{ position: "relative", marginBottom: 16 }}>
              {/* Cute sleeping wallet box */}
              <div
                style={{
                  width: 64,
                  height: 48,
                  borderRadius: 10,
                  background: "#86efac",
                  border: "2px solid #22c55e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: 6,
                  boxShadow: "0 4px 12px rgba(34, 197, 94, 0.18)",
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 18,
                    borderRadius: 4,
                    background: "#15803d",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#fef08a" }} />
                </div>
              </div>
              <span
                style={{
                  position: "absolute",
                  top: -14,
                  right: -10,
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#16a34a",
                }}
              >
                z
                <span style={{ fontSize: 18 }}>Z</span>
              </span>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 750, color: "var(--ink)", margin: "0 0 6px" }}>
              No transactions to show
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
              Start collecting payments to view transactions
            </p>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => router.push("/quick-collect")}
              style={{ background: "#059669", borderColor: "#059669", fontWeight: 700 }}
            >
              <Icon name="zap" size={14} />
              <span>Collect Payment Now</span>
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice / Ref #</th>
                  <th>Customer / Member</th>
                  <th>Date</th>
                  <th>Total Amount</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const statusTone =
                    inv.status === "PAID"
                      ? "green"
                      : inv.status === "PARTIALLY_PAID"
                        ? "blue"
                        : "amber";

                  const whatsappMsg = `Hello ${inv.person?.displayName || "Customer"}, your invoice ${inv.invoiceNumber} for ${formatCurrency(inv.grandTotalMinor)} has a balance due of ${formatCurrency(inv.balanceDueMinor)}. Thank you! - ${orgName}`;
                  const whatsappUrl = inv.person?.primaryPhone
                    ? `https://wa.me/${inv.person.primaryPhone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMsg)}`
                    : null;

                  return (
                    <tr key={inv.id}>
                      <td>
                        <strong>{inv.invoiceNumber}</strong>
                        {inv.notes && (
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{inv.notes}</div>
                        )}
                      </td>
                      <td>
                        <strong>{inv.person?.displayName || "Unknown Customer"}</strong>
                        {inv.person?.primaryPhone && (
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                            {inv.person.primaryPhone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 12.5 }}>
                          {new Date(inv.issueDate || inv.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 13.5 }}>
                          {formatCurrency(inv.grandTotalMinor, inv.currency)}
                        </strong>
                      </td>
                      <td>
                        <strong
                          style={{
                            fontSize: 13.5,
                            color: inv.balanceDueMinor > 0 ? "#b91c1c" : "#059669",
                          }}
                        >
                          {formatCurrency(inv.balanceDueMinor, inv.currency)}
                        </strong>
                      </td>
                      <td>
                        <Badge tone={statusTone}>{inv.status.replace(/_/g, " ")}</Badge>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          {whatsappUrl && inv.balanceDueMinor > 0 && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              title="Share on WhatsApp"
                              style={{ padding: "4px 8px", color: "#15803d", borderColor: "#86efac", background: "#f0fdf4" }}
                            >
                              <Icon name="whatsapp" size={14} />
                            </a>
                          )}

                          {inv.balanceDueMinor > 0 && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setPaymentModalInvoice(inv);
                                setPaymentAmount(inv.balanceDueMinor / 100);
                              }}
                              style={{ background: "#059669", borderColor: "#059669", fontSize: 12, padding: "4px 10px" }}
                            >
                              Collect
                            </button>
                          )}

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedInvoice(inv)}
                            style={{ fontSize: 12, padding: "4px 10px" }}
                          >
                            Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* View Receipt Modal */}
        <Modal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          title={`Receipt - ${selectedInvoice?.invoiceNumber}`}
          subtitle={`Issued by ${orgName}`}
          maxWidth={460}
        >
          {selectedInvoice && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 13 }}>
              <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "var(--muted)" }}>Customer:</span>
                  <strong>{selectedInvoice.person?.displayName}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "var(--muted)" }}>Mobile:</span>
                  <span>{selectedInvoice.person?.primaryPhone || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "var(--muted)" }}>Date:</span>
                  <span>{new Date(selectedInvoice.issueDate).toLocaleDateString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "var(--muted)" }}>Status:</span>
                  <Badge tone={selectedInvoice.status === "PAID" ? "green" : "amber"}>
                    {selectedInvoice.status}
                  </Badge>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <strong>Total Amount:</strong>
                  <strong style={{ color: "#059669", fontSize: 15 }}>
                    {formatCurrency(selectedInvoice.grandTotalMinor, selectedInvoice.currency)}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span>Balance Due:</span>
                  <strong style={{ color: selectedInvoice.balanceDueMinor > 0 ? "#b91c1c" : "#059669" }}>
                    {formatCurrency(selectedInvoice.balanceDueMinor, selectedInvoice.currency)}
                  </strong>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  <strong>Notes:</strong> {selectedInvoice.notes}
                </div>
              )}

              <div className="modal-footer" style={{ margin: "-22px", marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedInvoice(null)}
                >
                  Close
                </button>
                <a
                  href={`${api}/finance/invoices/${selectedInvoice.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ background: "#059669", borderColor: "#059669" }}
                >
                  <Icon name="download" size={14} />
                  <span>Download PDF</span>
                </a>
              </div>
            </div>
          )}
        </Modal>

        {/* Record Payment Modal */}
        <Modal
          isOpen={Boolean(paymentModalInvoice)}
          onClose={() => setPaymentModalInvoice(null)}
          title="Collect Fee / Record Payment"
          subtitle={`Invoice ${paymentModalInvoice?.invoiceNumber} (${paymentModalInvoice?.person?.displayName})`}
          maxWidth={460}
        >
          {paymentModalInvoice && (
            <form onSubmit={handleRecordPayment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {paymentError && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    color: "#991b1b",
                    fontSize: 12.5,
                    fontWeight: 650,
                  }}
                >
                  ⚠️ {paymentError}
                </div>
              )}
              <div className="form-group">
                <label>Amount to Collect (₹) *</label>
                <input
                  type="number"
                  min={1}
                  max={paymentModalInvoice.balanceDueMinor / 100}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                  required
                />
                <small style={{ color: "var(--muted)", fontSize: 11 }}>
                  Maximum due balance: {formatCurrency(paymentModalInvoice.balanceDueMinor)}
                </small>
              </div>

              <div className="form-group">
                <label>Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff" }}
                >
                  <option value="UPI">UPI / Google Pay / PhonePe</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT / IMPS</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label>Transaction / UTR Reference</label>
                <input
                  type="text"
                  placeholder="Eg: UPI Ref or Receipt #"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                />
              </div>

              <div className="modal-footer" style={{ margin: "-22px", marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPaymentModalInvoice(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={paymentBusy || paymentAmount <= 0}
                  style={{ background: "#059669", borderColor: "#059669" }}
                >
                  {paymentBusy ? "Recording…" : "Save Payment & Issue Receipt"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <div className="state-spinner" />
          <p>Loading transactions…</p>
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
