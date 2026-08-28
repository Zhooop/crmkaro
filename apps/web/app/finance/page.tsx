"use client";

import {
  AppShell,
  Badge,
  Drawer,
  EmptyState,
  Icon,
  Modal,
  StatCard,
  Tabs,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const nav: NavItem[] = [
  { label: "Dashboard", icon: "home", href: "/" },
  { label: "People", icon: "people", href: "/people" },
  { label: "Leads & CRM", icon: "crm", href: "/crm" },
  { label: "Finance", icon: "finance", href: "/finance" },
  { label: "Payroll", icon: "payroll", href: "/payroll" },
  { label: "Inventory", icon: "inventory", href: "/inventory" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";

type InvoiceItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxRateBasisPoints: number;
  totalMinor: number;
};

type Payment = {
  id: string;
  amountMinor: number;
  method: "CASH" | "UPI" | "BANK_TRANSFER" | "CARD" | "CHEQUE";
  reference: string | null;
  notes: string | null;
  status: "COMPLETED" | "PARTIALLY_REFUNDED" | "REFUNDED";
  createdAt: string;
  invoice?: { invoiceNumber: string };
  person?: { displayName: string };
};

type Expense = {
  id: string;
  category: string;
  vendor: string | null;
  amountMinor: number;
  date: string;
  description: string | null;
  status: "RECORDED" | "VOID";
  createdAt: string;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  personId: string;
  person?: { id: string; displayName: string; email: string | null; primaryPhone: string | null };
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  balanceDueMinor: number;
  notes: string | null;
  items: InvoiceItem[];
  payments: Payment[];
  createdAt: string;
};

type PersonOption = {
  id: string;
  displayName: string;
  email: string | null;
};

function formatMoney(amountMinor: number | null | undefined, currency = "INR") {
  if (!amountMinor) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function FinanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  // Data states
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "expenses">("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Context & AppShell info
  const [orgName, setOrgName] = useState("CRMKaro Workspace");
  const [userName, setUserName] = useState("Workspace User");
  const [userRole, setUserRole] = useState("Accountant");
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);

  // Modals & Drawers
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [createExpenseOpen, setCreateExpenseOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<Payment | null>(null);

  // Form states - Create Invoice
  const [formPersonId, setFormPersonId] = useState("");
  const [formInvoiceNumber, setFormInvoiceNumber] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<
    Array<{ description: string; quantity: number; unitPrice: number; taxRate: number }>
  >([{ description: "Professional Services", quantity: 1, unitPrice: 5000, taxRate: 18 }]);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");

  // Form states - Record Payment
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "BANK_TRANSFER" | "CARD" | "CHEQUE">("UPI");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);

  // Form states - Refund
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);

  // Form states - Record Expense
  const [expCategory, setExpCategory] = useState("Office Supplies");
  const [expVendor, setExpVendor] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expDesc, setExpDesc] = useState("");
  const [expBusy, setExpBusy] = useState(false);

  // Load session context
  const loadContext = useCallback(async () => {
    try {
      const meRes = await fetch(`${api}/auth/me`, { credentials: "include" });
      if (meRes.status === 401) {
        router.replace("/login");
        return;
      }
      const orgsRes = await fetch(`${api}/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgList = await orgsRes.json();
        const activeOrgEntry = orgList.find(
          (o: { organisation: { id: string; name: string } | null; role: { name: string } }) =>
            o.organisation,
        );
        if (activeOrgEntry?.organisation) {
          setOrgName(activeOrgEntry.organisation.name);
          setUserRole(activeOrgEntry.role?.name || "Accountant");
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

  // Load people for dropdown
  const loadPeople = useCallback(async () => {
    try {
      const res = await fetch(`${api}/people?limit=100`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPeople(data.items || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  // Load Invoices
  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (invoiceStatusFilter !== "ALL") params.set("status", invoiceStatusFilter);
      const res = await fetch(`${api}/finance/invoices?${params.toString()}`, { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load invoices.");
      const data = await res.json();
      setInvoices(data.items || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, invoiceStatusFilter, router]);

  // Load Expenses
  const loadExpenses = useCallback(async () => {
    try {
      const res = await fetch(`${api}/finance/expenses`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  useEffect(() => {
    loadContext();
    loadPeople();
  }, [loadContext, loadPeople]);

  useEffect(() => {
    if (activeTab === "invoices" || activeTab === "payments") {
      loadInvoices();
    } else if (activeTab === "expenses") {
      loadExpenses();
    }
  }, [activeTab, loadInvoices, loadExpenses]);

  // Check URL params
  useEffect(() => {
    const action = searchParams.get("action");
    const personId = searchParams.get("personId");
    const invoiceId = searchParams.get("invoiceId");

    if (action === "new-invoice") {
      if (personId) setFormPersonId(personId);
      const randomNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setFormInvoiceNumber(randomNum);
      setCreateInvoiceOpen(true);
    }
    if (action === "new-expense") {
      setCreateExpenseOpen(true);
    }
    if (invoiceId) {
      fetch(`${api}/finance/invoices/${invoiceId}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((inv) => {
          if (inv) setDetailInvoice(inv);
        })
        .catch(() => {});
    }
  }, [searchParams, api]);

  // Calculate metrics
  const totalBilledMinor = invoices.reduce((acc, inv) => acc + inv.totalMinor, 0);
  const totalPaidMinor = invoices.reduce((acc, inv) => acc + inv.amountPaidMinor, 0);
  const totalBalanceDueMinor = invoices
    .filter((inv) => inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID")
    .reduce((acc, inv) => acc + inv.balanceDueMinor, 0);
  const totalExpensesMinor = expenses
    .filter((e) => e.status === "RECORDED")
    .reduce((acc, e) => acc + e.amountMinor, 0);

  // All recorded payments flat list
  const allPayments = invoices.flatMap((inv) =>
    (inv.payments || []).map((p) => ({
      ...p,
      invoice: { invoiceNumber: inv.invoiceNumber },
      person: inv.person,
    })),
  );

  async function handleCreateInvoice(e: FormEvent) {
    e.preventDefault();
    if (!formPersonId) {
      setInvoiceError("Please select a customer.");
      return;
    }
    setInvoiceBusy(true);
    setInvoiceError("");
    try {
      const itemsPayload = formItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unitPriceMinor: Math.round(Number(item.unitPrice) * 100),
        taxRateBasisPoints: Math.round(Number(item.taxRate) * 100),
      }));

      const res = await fetch(`${api}/finance/invoices`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personId: formPersonId,
          dueDate: formDueDate ? new Date(formDueDate).toISOString() : undefined,
          notes: formNotes || undefined,
          items: itemsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create invoice.");
      setCreateInvoiceOpen(false);
      loadInvoices();
    } catch (err) {
      setInvoiceError((err as Error).message);
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function handleIssueInvoice(invoiceId: string) {
    try {
      const res = await fetch(`${api}/finance/invoices/${invoiceId}/issue`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const updated = await res.json();
        setDetailInvoice(updated);
        loadInvoices();
      }
    } catch {
      // ignore
    }
  }

  async function handleVoidInvoice(invoiceId: string) {
    if (!confirm("Are you sure you want to void this invoice?")) return;
    try {
      const res = await fetch(`${api}/finance/invoices/${invoiceId}/void`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const updated = await res.json();
        setDetailInvoice(updated);
        loadInvoices();
      }
    } catch {
      // ignore
    }
  }

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    if (!detailInvoice) return;
    setPaymentBusy(true);
    try {
      const amt = parseFloat(paymentAmount);
      const res = await fetch(`${api}/finance/invoices/${detailInvoice.id}/payments`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountMinor: Math.round(amt * 100),
          method: paymentMethod,
          reference: paymentRef || undefined,
          notes: paymentNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Payment recording failed.");
      setRecordPaymentOpen(false);
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNotes("");
      // refresh detail invoice
      const invRes = await fetch(`${api}/finance/invoices/${detailInvoice.id}`, { credentials: "include" });
      if (invRes.ok) setDetailInvoice(await invRes.json());
      loadInvoices();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPaymentBusy(false);
    }
  }

  async function handleRefundPayment(e: FormEvent) {
    e.preventDefault();
    if (!selectedPaymentForRefund) return;
    setRefundBusy(true);
    try {
      const amt = parseFloat(refundAmount);
      const res = await fetch(`${api}/finance/payments/${selectedPaymentForRefund.id}/refund`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountMinor: Math.round(amt * 100),
          reason: refundReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Refund failed.");
      setRefundOpen(false);
      setSelectedPaymentForRefund(null);
      setRefundAmount("");
      setRefundReason("");
      loadInvoices();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRefundBusy(false);
    }
  }

  async function handleRecordExpense(e: FormEvent) {
    e.preventDefault();
    setExpBusy(true);
    try {
      const amt = parseFloat(expAmount);
      const res = await fetch(`${api}/finance/expenses`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: expCategory,
          vendor: expVendor || undefined,
          amountMinor: Math.round(amt * 100),
          date: new Date(expDate).toISOString(),
          description: expDesc || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to record expense.");
      setCreateExpenseOpen(false);
      setExpVendor("");
      setExpAmount("");
      setExpDesc("");
      loadExpenses();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setExpBusy(false);
    }
  }

  function addItemRow() {
    setFormItems([...formItems, { description: "", quantity: 1, unitPrice: 0, taxRate: 18 }]);
  }

  function removeItemRow(index: number) {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  }

  // Invoice calculated preview
  const invoiceSubtotal = formItems.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  );
  const invoiceTax = formItems.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) * ((Number(it.taxRate) || 0) / 100),
    0,
  );
  const invoiceGrandTotal = invoiceSubtotal + invoiceTax;

  const tabItems = [
    { id: "invoices", label: "Invoices", count: invoices.length },
    { id: "payments", label: "Payments Received", count: allPayments.length },
    { id: "expenses", label: "Expenses", count: expenses.length },
  ];

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/finance"
      nav={nav}
      userName={userName}
      userRole={userRole}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="finance" size={14} /> Revenue & Expenses
          </p>
          <h1>Finance & Billing</h1>
          <p className="subheading">
            Manage client invoices, collect payments, track dues, and monitor expenses.
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCreateExpenseOpen(true)}
          >
            <Icon name="dollar" size={15} />
            <span>Record Expense</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const randomNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
              setFormInvoiceNumber(randomNum);
              setCreateInvoiceOpen(true);
            }}
          >
            <Icon name="plus" size={15} />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="stats-grid">
        <StatCard
          label="Total Billed"
          value={formatMoney(totalBilledMinor)}
          change="All invoices"
          icon="finance"
          tone="blue"
        />
        <StatCard
          label="Total Collected"
          value={formatMoney(totalPaidMinor)}
          change="Payments received"
          icon="checkCircle"
          tone="teal"
        />
        <StatCard
          label="Payments Due"
          value={formatMoney(totalBalanceDueMinor)}
          change="Outstanding dues"
          icon="alertCircle"
          tone={totalBalanceDueMinor > 0 ? "rose" : "teal"}
        />
        <StatCard
          label="Total Expenses"
          value={formatMoney(totalExpensesMinor)}
          change="Recorded outflows"
          icon="dollar"
          tone="amber"
        />
      </div>

      <Tabs
        items={tabItems}
        active={activeTab}
        onChange={(id) => setActiveTab(id as "invoices" | "payments" | "expenses")}
      />

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <>
          <div className="toolbar">
            <div className="toolbar-actions">
              <select
                className="filter-select"
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              >
                <option value="ALL">All Invoices</option>
                <option value="DRAFT">Draft</option>
                <option value="ISSUED">Issued</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
                <option value="VOID">Void</option>
              </select>

              <div className="search-box">
                <Icon name="search" size={15} />
                <input
                  type="text"
                  placeholder="Search invoice or customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="state-spinner" />
              <p>Loading invoices…</p>
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon="finance"
              title="No invoices found"
              description="Create and issue professional invoices for your products and services."
              actionLabel="Create Invoice"
              onAction={() => setCreateInvoiceOpen(true)}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Total Amount</th>
                    <th>Balance Due</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="clickable"
                      onClick={() => setDetailInvoice(inv)}
                    >
                      <td>
                        <strong>{inv.invoiceNumber}</strong>
                      </td>
                      <td>{inv.person?.displayName || "—"}</td>
                      <td>{new Date(inv.issueDate).toLocaleDateString()}</td>
                      <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                      <td>
                        <strong>{formatMoney(inv.totalMinor)}</strong>
                      </td>
                      <td>
                        <span style={{ color: inv.balanceDueMinor > 0 ? "var(--danger)" : "var(--ink)", fontWeight: 600 }}>
                          {formatMoney(inv.balanceDueMinor)}
                        </span>
                      </td>
                      <td>
                        <Badge
                          tone={
                            inv.status === "PAID"
                              ? "green"
                              : inv.status === "PARTIALLY_PAID"
                                ? "amber"
                                : inv.status === "ISSUED"
                                  ? "blue"
                                  : inv.status === "VOID"
                                    ? "red"
                                    : "neutral"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDetailInvoice(inv)}
                        >
                          <Icon name="eye" size={14} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="table-wrap">
          {allPayments.length === 0 ? (
            <EmptyState
              icon="finance"
              title="No payments recorded yet"
              description="Record payments against issued invoices to keep track of collections."
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allPayments.map((pay) => (
                  <tr key={pay.id}>
                    <td>{new Date(pay.createdAt).toLocaleDateString()}</td>
                    <td>
                      <strong>{pay.invoice?.invoiceNumber}</strong>
                    </td>
                    <td>{pay.person?.displayName || "—"}</td>
                    <td>
                      <Badge tone="neutral">{pay.method}</Badge>
                    </td>
                    <td>
                      <strong style={{ color: "#15803d" }}>
                        +{formatMoney(pay.amountMinor)}
                      </strong>
                    </td>
                    <td>{pay.reference || "—"}</td>
                    <td>
                      <Badge
                        tone={
                          pay.status === "COMPLETED"
                            ? "green"
                            : pay.status === "REFUNDED"
                              ? "red"
                              : "amber"
                        }
                      >
                        {pay.status}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {pay.status === "COMPLETED" && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            setSelectedPaymentForRefund(pay);
                            setRefundAmount((pay.amountMinor / 100).toString());
                            setRefundOpen(true);
                          }}
                        >
                          <Icon name="refresh" size={13} />
                          <span>Refund</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === "expenses" && (
        <div className="table-wrap">
          {expenses.length === 0 ? (
            <EmptyState
              icon="dollar"
              title="No expenses recorded"
              description="Track operational expenses and vendor purchases."
              actionLabel="Record Expense"
              onAction={() => setCreateExpenseOpen(true)}
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>{new Date(exp.date).toLocaleDateString()}</td>
                    <td>
                      <Badge tone="blue">{exp.category}</Badge>
                    </td>
                    <td>
                      <strong>{exp.vendor || "—"}</strong>
                    </td>
                    <td>{exp.description || "—"}</td>
                    <td>
                      <strong style={{ color: "#b91c1c" }}>
                        -{formatMoney(exp.amountMinor)}
                      </strong>
                    </td>
                    <td>
                      <Badge tone={exp.status === "RECORDED" ? "neutral" : "red"}>
                        {exp.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Invoice Detail Drawer */}
      <Drawer
        isOpen={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        title={detailInvoice?.invoiceNumber || "Invoice"}
        subtitle={`Issued to ${detailInvoice?.person?.displayName || "Customer"}`}
        width={520}
      >
        {detailInvoice && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Status & Totals Card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 16,
                background: "#f8fafc",
                borderRadius: 12,
                border: "1px solid var(--line)",
              }}
            >
              <div>
                <small style={{ color: "var(--muted)", fontSize: 11 }}>Total Amount</small>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {formatMoney(detailInvoice.totalMinor)}
                </div>
                <small style={{ color: detailInvoice.balanceDueMinor > 0 ? "var(--danger)" : "#15803d", fontWeight: 600 }}>
                  Balance: {formatMoney(detailInvoice.balanceDueMinor)}
                </small>
              </div>
              <Badge
                tone={
                  detailInvoice.status === "PAID"
                    ? "green"
                    : detailInvoice.status === "PARTIALLY_PAID"
                      ? "amber"
                      : detailInvoice.status === "ISSUED"
                        ? "blue"
                        : detailInvoice.status === "VOID"
                          ? "red"
                          : "neutral"
                }
              >
                {detailInvoice.status}
              </Badge>
            </div>

            {/* Actions Bar */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {detailInvoice.status === "DRAFT" && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleIssueInvoice(detailInvoice.id)}
                >
                  <Icon name="check" size={14} />
                  <span>Issue Invoice</span>
                </button>
              )}
              {(detailInvoice.status === "ISSUED" || detailInvoice.status === "PARTIALLY_PAID") && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setPaymentAmount((detailInvoice.balanceDueMinor / 100).toString());
                    setRecordPaymentOpen(true);
                  }}
                >
                  <Icon name="dollar" size={14} />
                  <span>Record Payment</span>
                </button>
              )}
              {detailInvoice.status !== "VOID" && detailInvoice.status !== "PAID" && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleVoidInvoice(detailInvoice.id)}
                >
                  <Icon name="close" size={14} />
                  <span>Void Invoice</span>
                </button>
              )}
              <a
                href={`${api}/finance/invoices/${detailInvoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <Icon name="download" size={14} />
                <span>Download PDF</span>
              </a>
            </div>

            {/* Key Value Details */}
            <div className="key-value-list">
              <div className="key-value-item">
                <label>Customer</label>
                <span>{detailInvoice.person?.displayName}</span>
              </div>
              <div className="key-value-item">
                <label>Email</label>
                <span>{detailInvoice.person?.email || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Issue Date</label>
                <span>{new Date(detailInvoice.issueDate).toLocaleDateString()}</span>
              </div>
              <div className="key-value-item">
                <label>Due Date</label>
                <span>
                  {detailInvoice.dueDate ? new Date(detailInvoice.dueDate).toLocaleDateString() : "Immediate"}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block" }}>
                Line Items
              </label>
              <table className="data-table" style={{ border: "1px solid var(--line)", borderRadius: 8 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detailInvoice.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.description}</td>
                      <td>{it.quantity}</td>
                      <td>{formatMoney(it.unitPriceMinor)}</td>
                      <td>
                        <strong>{formatMoney(it.totalMinor)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payments against this invoice */}
            {detailInvoice.payments && detailInvoice.payments.length > 0 && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block" }}>
                  Payments History
                </label>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {detailInvoice.payments.map((p) => (
                    <li
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "#f8fafc",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <strong>{formatMoney(p.amountMinor)}</strong> via {p.method}
                        <div style={{ color: "var(--muted)", fontSize: 10 }}>
                          {new Date(p.createdAt).toLocaleDateString()} · Ref: {p.reference || "N/A"}
                        </div>
                      </div>
                      <Badge tone={p.status === "COMPLETED" ? "green" : "amber"}>{p.status}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create Invoice Modal */}
      <Modal
        isOpen={createInvoiceOpen}
        onClose={() => setCreateInvoiceOpen(false)}
        title="Create New Invoice"
        subtitle="Add line items and issue to customer"
        maxWidth={640}
      >
        <form onSubmit={handleCreateInvoice} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {invoiceError && (
            <div style={{ padding: 10, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12 }}>
              {invoiceError}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>Customer *</label>
              <select
                className="filter-select"
                value={formPersonId}
                onChange={(e) => setFormPersonId(e.target.value)}
                required
              >
                <option value="">Select customer from directory</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} {p.email ? `(${p.email})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Line Items Builder */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Invoice Items</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                <Icon name="plus" size={13} />
                <span>Add Item</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {formItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1.2fr 1fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Description / Service"
                    value={item.description}
                    onChange={(e) => {
                      const updated = [...formItems];
                      const current = updated[idx];
                      if (current) {
                        current.description = e.target.value;
                        setFormItems(updated);
                      }
                    }}
                    required
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...formItems];
                      const current = updated[idx];
                      if (current) {
                        current.quantity = Number(e.target.value) || 1;
                        setFormItems(updated);
                      }
                    }}
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Price (₹)"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const updated = [...formItems];
                      const current = updated[idx];
                      if (current) {
                        current.unitPrice = Number(e.target.value) || 0;
                        setFormItems(updated);
                      }
                    }}
                    required
                  />
                  <select
                    className="filter-select"
                    value={item.taxRate}
                    onChange={(e) => {
                      const updated = [...formItems];
                      const current = updated[idx];
                      if (current) {
                        current.taxRate = Number(e.target.value) || 0;
                        setFormItems(updated);
                      }
                    }}
                  >
                    <option value="0">0% GST</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => removeItemRow(idx)}
                    disabled={formItems.length === 1}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              ))}
            </div>

            {/* Calculations Summary */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 14,
                padding: "10px 14px",
                background: "#f8fafc",
                borderRadius: 8,
              }}
            >
              <div style={{ textAlign: "right", fontSize: 12 }}>
                <div>Subtotal: ₹{invoiceSubtotal.toLocaleString("en-IN")}</div>
                <div>Tax: ₹{invoiceTax.toLocaleString("en-IN")}</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                  Grand Total: ₹{invoiceGrandTotal.toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Payment Terms / Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Bank transfer details, due within 15 days..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateInvoiceOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={invoiceBusy}>
              {invoiceBusy ? "Saving…" : "Save Invoice Draft"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={recordPaymentOpen}
        onClose={() => setRecordPaymentOpen(false)}
        title="Record Payment"
        subtitle={`Invoice ${detailInvoice?.invoiceNumber}`}
        maxWidth={440}
      >
        <form onSubmit={handleRecordPayment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label>Amount Received (₹) *</label>
            <input
              type="number"
              step="any"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Payment Method *</label>
            <select
              className="filter-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
            >
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Debit / Credit Card</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
          <div className="form-group">
            <label>Transaction / UTR Reference</label>
            <input
              type="text"
              placeholder="e.g. UPI-987654321"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input
              type="text"
              placeholder="Optional notes"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRecordPaymentOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={paymentBusy}>
              {paymentBusy ? "Recording…" : "Save Payment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Expense Modal */}
      <Modal
        isOpen={createExpenseOpen}
        onClose={() => setCreateExpenseOpen(false)}
        title="Record Business Expense"
        subtitle="Log operational outflow"
        maxWidth={460}
      >
        <form onSubmit={handleRecordExpense} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label>Expense Category *</label>
            <select
              className="filter-select"
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
            >
              <option value="Office Supplies">Office Supplies</option>
              <option value="Software & Subscriptions">Software & Subscriptions</option>
              <option value="Rent & Utilities">Rent & Utilities</option>
              <option value="Travel & Meals">Travel & Meals</option>
              <option value="Marketing & Ads">Marketing & Ads</option>
              <option value="Equipment & Hardware">Equipment & Hardware</option>
              <option value="Professional Fees">Professional Fees</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Vendor / Recipient</label>
            <input
              type="text"
              placeholder="e.g. Amazon, Airtel, AWS"
              value={expVendor}
              onChange={(e) => setExpVendor(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Amount (₹) *</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 2500"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Date *</label>
            <input
              type="date"
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Description / Note</label>
            <input
              type="text"
              placeholder="Details of the expense"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateExpenseOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={expBusy}>
              {expBusy ? "Recording…" : "Save Expense"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Refund Payment Modal */}
      <Modal
        isOpen={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Issue Refund"
        subtitle="Record partial or full payment refund"
        maxWidth={420}
      >
        <form onSubmit={handleRefundPayment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label>Refund Amount (₹) *</label>
            <input
              type="number"
              step="any"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Refund Reason *</label>
            <input
              type="text"
              placeholder="e.g. Customer cancelled order"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRefundOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={refundBusy}>
              {refundBusy ? "Processing…" : "Confirm Refund"}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

export default function FinancePage() {
  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <div className="state-spinner" />
          <p>Loading finance…</p>
        </div>
      }
    >
      <FinanceContent />
    </Suspense>
  );
}

