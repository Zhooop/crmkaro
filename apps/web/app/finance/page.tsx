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
  { label: "People & Directory", icon: "people", href: "/people" },
  { label: "Leads & CRM", icon: "crm", href: "/crm" },
  { label: "Finance & Fees", icon: "finance", href: "/finance" },
  { label: "Staff & Salary", icon: "payroll", href: "/payroll" },
  { label: "Inventory & Stock", icon: "inventory", href: "/inventory" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

const INVOICE_ITEM_PRESETS = [
  "Tuition / Course Fees",
  "Admission / Registration Fees",
  "Monthly / Term Academic Fees",
  "Examination / Certification Fees",
  "Coaching / Training Workshop",
  "Membership / Subscription Fees",
  "Consulting / Professional Services",
  "Monthly Retainer / Service Contract",
  "Salary / Remuneration / Wages",
  "Software Development & IT Services",
  "Software License / Cloud Hosting",
  "Product Sale / Goods & Materials",
  "Annual Maintenance Contract (AMC)",
  "Marketing & Advertising Services",
  "Hostel / Accommodation Fees",
  "Transportation / Logistics Charges",
  "Security Deposit / Advance",
  "Miscellaneous Charges",
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
  primaryPhone?: string | null;
  types?: Array<{ type: string }>;
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
  const api =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" && window.location.hostname.endsWith("crmkaro.com")
      ? "https://api.crmkaro.com/api/v1"
      : "http://localhost:4000/api/v1");

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
    Array<{ description: string; quantity: number | string; unitPrice: number | string; taxRate: number }>
  >([{ description: "", quantity: 1, unitPrice: "", taxRate: 18 }]);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [personSearchLoading, setPersonSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PersonOption[]>([]);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // Form states - Record Payment
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "BANK_TRANSFER" | "CARD" | "CHEQUE">("UPI");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Form states - Refund
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState("");

  // Form states - Record Expense
  const [expCategory, setExpCategory] = useState("Office Rent & Maintenance");
  const [expVendor, setExpVendor] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expDesc, setExpDesc] = useState("");
  const [expBusy, setExpBusy] = useState(false);
  const [expError, setExpError] = useState("");

  // Toast notification feedback state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }

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
    const presetDesc = searchParams.get("description");
    const presetPrice = searchParams.get("price");

    if (action === "new-invoice") {
      openCreateInvoiceModal(personId || undefined, presetDesc || undefined, presetPrice || undefined);
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

  // Debounced live search for customers/students when creating invoice
  useEffect(() => {
    if (!createInvoiceOpen || !personSearchQuery.trim()) {
      setSearchResults([]);
      setPersonSearchLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setPersonSearchLoading(true);
      try {
        const res = await fetch(
          `${api}/people?search=${encodeURIComponent(personSearchQuery.trim())}&limit=50`,
          { credentials: "include" },
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
        }
      } catch {
        // ignore
      } finally {
        setPersonSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [personSearchQuery, createInvoiceOpen, api]);

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
      setInvoiceError("Please select a customer / student from the directory.");
      return;
    }
    const validItems = formItems.filter((it) => it.description.trim() && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      setInvoiceError("Please add at least one line item with description and valid price.");
      return;
    }
    setInvoiceBusy(true);
    setInvoiceError("");
    try {
      const itemsPayload = validItems.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unitPriceMinor: Math.round(Number(item.unitPrice) * 100) || 0,
        taxRateBps: Math.round(Number(item.taxRate) * 100) || 0,
      }));

      const now = new Date();
      const issueDate = now.toISOString();
      const dueDate = formDueDate
        ? new Date(formDueDate).toISOString()
        : new Date(now.getTime() + 15 * 86400000).toISOString();

      const res = await fetch(`${api}/finance/invoices`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personId: formPersonId,
          issueDate,
          dueDate,
          notes: formNotes?.trim() || undefined,
          items: itemsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.message || "Failed to create invoice.";
        if (data.fields && typeof data.fields === "object") {
          const fieldMsgs = Object.entries(data.fields)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : errs}`)
            .join("; ");
          if (fieldMsgs) errMsg = `${errMsg} (${fieldMsgs})`;
        }
        throw new Error(errMsg);
      }
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
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError("Please enter a valid payment amount.");
      return;
    }
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const res = await fetch(`${api}/finance/invoices/${detailInvoice.id}/payments`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountMinor: Math.round(amt * 100),
          method: paymentMethod,
          reference: paymentRef?.trim() || undefined,
          notes: paymentNotes?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.message || "Payment recording failed.";
        if (data.fields && typeof data.fields === "object") {
          const fieldMsgs = Object.entries(data.fields)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : errs}`)
            .join("; ");
          if (fieldMsgs) errMsg = `${errMsg} (${fieldMsgs})`;
        }
        throw new Error(errMsg);
      }
      setRecordPaymentOpen(false);
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNotes("");
      const invRes = await fetch(`${api}/finance/invoices/${detailInvoice.id}`, { credentials: "include" });
      if (invRes.ok) setDetailInvoice(await invRes.json());
      loadInvoices();
      showToast(`Payment of ₹${amt.toLocaleString("en-IN")} recorded successfully!`, "success");
    } catch (err) {
      setPaymentError((err as Error).message);
    } finally {
      setPaymentBusy(false);
    }
  }

  async function handleRefundPayment(e: FormEvent) {
    e.preventDefault();
    if (!selectedPaymentForRefund) return;
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0) {
      setRefundError("Please enter a valid refund amount.");
      return;
    }
    setRefundBusy(true);
    setRefundError("");
    try {
      const res = await fetch(`${api}/finance/payments/${selectedPaymentForRefund.id}/refund`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountMinor: Math.round(amt * 100),
          reason: refundReason?.trim() || "Customer requested refund",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.message || "Refund failed.";
        if (data.fields && typeof data.fields === "object") {
          const fieldMsgs = Object.entries(data.fields)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : errs}`)
            .join("; ");
          if (fieldMsgs) errMsg = `${errMsg} (${fieldMsgs})`;
        }
        throw new Error(errMsg);
      }
      setRefundOpen(false);
      setSelectedPaymentForRefund(null);
      setRefundAmount("");
      setRefundReason("");
      loadInvoices();
      showToast(`Refund of ₹${amt.toLocaleString("en-IN")} processed successfully!`, "success");
    } catch (err) {
      setRefundError((err as Error).message);
    } finally {
      setRefundBusy(false);
    }
  }

  async function handleRecordExpense(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) {
      setExpError("Please enter a valid expense amount.");
      return;
    }
    setExpBusy(true);
    setExpError("");
    try {
      const now = expDate ? new Date(expDate) : new Date();
      const expenseDate = isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();

      const res = await fetch(`${api}/finance/expenses`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: expCategory,
          vendor: expVendor?.trim() || undefined,
          amountMinor: Math.round(amt * 100),
          expenseDate,
          date: expenseDate,
          description: expDesc?.trim() || expCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.message || "Failed to record expense.";
        if (data.fields && typeof data.fields === "object") {
          const fieldMsgs = Object.entries(data.fields)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : errs}`)
            .join("; ");
          if (fieldMsgs) errMsg = `${errMsg} (${fieldMsgs})`;
        }
        throw new Error(errMsg);
      }
      setCreateExpenseOpen(false);
      setExpVendor("");
      setExpAmount("");
      setExpDesc("");
      loadExpenses();
      showToast(`Business expense of ₹${amt.toLocaleString("en-IN")} recorded successfully!`, "success");
    } catch (err) {
      setExpError((err as Error).message);
    } finally {
      setExpBusy(false);
    }
  }

  function openCreateInvoiceModal(presetPersonId?: string, presetDesc?: string, presetPrice?: string) {
    const randomNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormInvoiceNumber(randomNum);
    setFormPersonId(presetPersonId || "");
    setPersonSearchQuery("");
    setSearchResults([]);
    setIsCustomerDropdownOpen(false);
    setFormDueDate("");
    setFormNotes("");
    setFormItems([{ description: presetDesc || "", quantity: 1, unitPrice: presetPrice || "", taxRate: 18 }]);
    setInvoiceError("");
    setCreateInvoiceOpen(true);
  }

  function addItemRow() {
    setFormItems([...formItems, { description: "", quantity: 1, unitPrice: "", taxRate: 18 }]);
  }

  function applyPreset(presetText: string, defaultPrice: string = "") {
    if (formItems.length === 1 && !formItems[0]?.description.trim()) {
      setFormItems([{ description: presetText, quantity: 1, unitPrice: defaultPrice || formItems[0]?.unitPrice || "", taxRate: 18 }]);
    } else {
      setFormItems([...formItems, { description: presetText, quantity: 1, unitPrice: defaultPrice, taxRate: 18 }]);
    }
  }

  function applyMonthFee(monthName: string, year: number = new Date().getFullYear()) {
    const feeDesc = `🎓 Monthly Academic / Tuition Fees — ${monthName} ${year}`;
    applyPreset(feeDesc, "3500");
  }

  function applyQuarterFee(quarterName: string, year: number = new Date().getFullYear()) {
    const feeDesc = `🎓 Quarterly Academic Fees — ${quarterName} ${year}`;
    applyPreset(feeDesc, "10000");
  }

  function setQuickDueDate(daysFromNow: number) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const dateStr = d.toISOString().split("T")[0];
    if (dateStr) setFormDueDate(dateStr);
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

  const selectedPerson =
    people.find((p) => p.id === formPersonId) ||
    searchResults.find((p) => p.id === formPersonId);

  const displayedPeople = personSearchQuery.trim()
    ? searchResults.length > 0
      ? searchResults
      : people.filter((p) => {
          const q = personSearchQuery.toLowerCase();
          return (
            p.displayName.toLowerCase().includes(q) ||
            (p.email && p.email.toLowerCase().includes(q)) ||
            (p.primaryPhone && p.primaryPhone.includes(q))
          );
        })
    : people.slice(0, 40);

  const tabItems = [
    { id: "invoices", label: "Invoices & Student Fees", count: invoices.length },
    { id: "payments", label: "Fee Collections & Receipts", count: allPayments.length },
    { id: "expenses", label: "Kharcha / Expenses", count: expenses.length },
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
      apiUrl={api}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="finance" size={14} /> Revenue, Fees & Kharcha
          </p>
          <h1>Finance & Fees Billing</h1>
          <p className="subheading">
            Track student fees, issue client invoices, collect payments, and log company kharcha / operating expenses.
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCreateExpenseOpen(true)}
            title="Log company operating expenses (rent, bills, ads, vendor costs)"
          >
            <Icon name="rupee" size={15} />
            <span>Record Kharcha (Expense)</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => openCreateInvoiceModal()}
            title="Generate a bill or invoice for your student or customer"
          >
            <Icon name="plus" size={15} />
            <span>+ Create Invoice / Bill</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="stats-grid">
        <StatCard
          label="Total Fees & Billed"
          value={formatMoney(totalBilledMinor)}
          change="All invoices & fees"
          icon="finance"
          tone="blue"
        />
        <StatCard
          label="Total Collected"
          value={formatMoney(totalPaidMinor)}
          change="Fee payments received"
          icon="checkCircle"
          tone="teal"
        />
        <StatCard
          label="Pending Fees & Dues"
          value={formatMoney(totalBalanceDueMinor)}
          change="Outstanding balances"
          icon="alertCircle"
          tone={totalBalanceDueMinor > 0 ? "rose" : "teal"}
        />
        <StatCard
          label="Total Kharcha"
          value={formatMoney(totalExpensesMinor)}
          change="Recorded outflows"
          icon="rupee"
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🧾</span>
              <div>
                <strong style={{ fontSize: 13, color: "#1e3a8a" }}>Customer Invoices & Billing (Income / Inflow)</strong>
                <div style={{ fontSize: 12, color: "#2563eb" }}>
                  Create itemized tax bills for your students or clients, collect payments, and track pending dues.
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => openCreateInvoiceModal()} style={{ flexShrink: 0 }}>
              <Icon name="plus" size={14} />
              <span>+ Create Invoice</span>
            </button>
          </div>

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
              onAction={() => openCreateInvoiceModal()}
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>💰</span>
              <div>
                <strong style={{ fontSize: 13, color: "#14532d" }}>Payment Collections & Receipts</strong>
                <div style={{ fontSize: 12, color: "#16a34a" }}>
                  Real-time transaction records of all payments collected from students/clients via UPI, Bank Transfer, Cash or Cards.
                </div>
              </div>
            </div>
          </div>

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fffbeb", borderRadius: 10, border: "1px solid #fde68a", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>💸</span>
              <div>
                <strong style={{ fontSize: 13, color: "#78350f" }}>Company Operating Expenses (Outflow / Kharcha)</strong>
                <div style={{ fontSize: 12, color: "#b45309" }}>
                  Track business operating spending like office rent, staff stipends, electricity/Wi-Fi bills, software tools, and marketing ads.
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setCreateExpenseOpen(true)} style={{ flexShrink: 0 }}>
              <Icon name="rupee" size={14} />
              <span>+ Record Business Expense</span>
            </button>
          </div>

          {expenses.length === 0 ? (
            <EmptyState
              icon="rupee"
              title="No expenses recorded"
              description="Track operational expenses and vendor purchases."
              actionLabel="+ Record Business Expense"
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
                  style={{ background: "#16a34a", borderColor: "#15803d" }}
                >
                  <Icon name="rupee" size={14} />
                  <span>
                    {detailInvoice.status === "PARTIALLY_PAID"
                      ? `Collect Next Installment (Due: ₹${(detailInvoice.balanceDueMinor / 100).toLocaleString("en-IN")})`
                      : "Collect Fee / Record Payment"}
                  </span>
                </button>
              )}
              {detailInvoice.status === "PAID" && detailInvoice.personId && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    openCreateInvoiceModal(detailInvoice.personId);
                  }}
                  style={{ color: "#166534", border: "1.5px solid #86efac", background: "#f0fdf4" }}
                >
                  <Icon name="plus" size={14} />
                  <span>+ Bill Next Month's Fees</span>
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
        subtitle="Generate & issue itemized tax-compliant invoice with automatic GST calculation"
        maxWidth={860}
      >
        <form onSubmit={handleCreateInvoice} className="invoice-modal-body">
          {invoiceError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {invoiceError}
            </div>
          )}

          {/* Top Card: Customer & Due Date */}
          <div className="invoice-top-card">
            {/* Customer Search / Selection */}
            <div className="form-group" style={{ margin: 0, position: "relative" }}>
              <label style={{ fontSize: 12, fontWeight: 750, color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Billed To (Customer / Student / Client) *</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)" }}>Live Directory Search</span>
              </label>
              {selectedPerson ? (
                <div className="selected-person-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div className="selected-person-avatar">
                      {selectedPerson.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <strong style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {selectedPerson.displayName}
                        </strong>
                        {selectedPerson.types && selectedPerson.types.length > 0 && selectedPerson.types[0]?.type && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 750,
                              background:
                                selectedPerson.types[0]?.type === "STUDENT"
                                  ? "#fef3c7"
                                  : "#e0f2fe",
                              color:
                                selectedPerson.types[0]?.type === "STUDENT"
                                  ? "#b45309"
                                  : "#0369a1",
                              padding: "2px 6px",
                              borderRadius: 4,
                              textTransform: "uppercase",
                              flexShrink: 0,
                            }}
                          >
                            {selectedPerson.types[0]?.type}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                        {selectedPerson.primaryPhone ? `📞 ${selectedPerson.primaryPhone} · ` : ""}
                        {selectedPerson.email || "No email provided"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0, marginLeft: 8, height: 32 }}
                    onClick={() => {
                      setFormPersonId("");
                      setPersonSearchQuery("");
                      setIsCustomerDropdownOpen(true);
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="person-combobox-wrap">
                  <input
                    type="text"
                    placeholder="🔍 Type customer name, student ID, phone number or email…"
                    value={personSearchQuery}
                    onChange={(e) => {
                      setPersonSearchQuery(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                  />
                  {personSearchLoading && (
                    <span
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 11,
                        color: "var(--muted)",
                      }}
                    >
                      Searching…
                    </span>
                  )}

                  {isCustomerDropdownOpen && (
                    <div className="person-dropdown-menu">
                      {displayedPeople.length === 0 ? (
                        <div style={{ padding: 14, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                          {personSearchLoading
                            ? "Searching customer directory..."
                            : `No customer or student found for "${personSearchQuery}".`}
                        </div>
                      ) : (
                        displayedPeople.map((p) => {
                          const pType =
                            p.types && p.types.length > 0 && p.types[0]?.type
                              ? p.types[0].type
                              : "CUSTOMER";
                          return (
                            <div
                              key={p.id}
                              className="person-dropdown-item"
                              onClick={() => {
                                setFormPersonId(p.id);
                                if (!people.some((existing) => existing.id === p.id)) {
                                  setPeople((prev) => [p, ...prev]);
                                }
                                setIsCustomerDropdownOpen(false);
                                setPersonSearchQuery("");
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.displayName}</span>
                                  <span
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 750,
                                      background:
                                        pType === "STUDENT"
                                          ? "#fef3c7"
                                          : "#e0f2fe",
                                      color:
                                        pType === "STUDENT"
                                          ? "#b45309"
                                          : "#0369a1",
                                      padding: "1px 5px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {pType}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                  {p.primaryPhone ? `${p.primaryPhone} · ` : ""}
                                  {p.email || "No email"}
                                </div>
                              </div>
                              <span style={{ fontSize: 11, color: "var(--brand)", fontWeight: 600 }}>Select →</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Due Date & Quick Due Selectors */}
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 750, color: "var(--ink)", margin: 0 }}>Payment Due Date</label>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setQuickDueDate(0)}
                    style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", color: "var(--brand)" }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDueDate(7)}
                    style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", color: "var(--brand)" }}
                  >
                    +7d
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDueDate(15)}
                    style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", color: "var(--brand)" }}
                  >
                    +15d
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDueDate(30)}
                    style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", color: "var(--brand)" }}
                  >
                    +30d
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 13 }}
              />
            </div>
          </div>

          {/* Line Items Builder */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink)" }}>Line Items & Services</label>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                  Type item name or choose from 1-click presets below
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                <Icon name="plus" size={13} />
                <span>Add Custom Row</span>
              </button>
            </div>

            {/* Quick Presets Bar */}
            <div className="invoice-presets-bar" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "8px 10px", background: "#f8fafc", borderRadius: 8, border: "1px solid var(--line)" }}>
              <span style={{ fontSize: 11, fontWeight: 750, color: "#64748b" }}>⚡ 1-Click Common Presets:</span>
              {[
                { name: "🎓 Full Course Fees", price: "25000" },
                { name: "📝 Admission / Reg. Fee", price: "1000" },
                { name: "📚 Books & Materials Kit", price: "2500" },
                { name: "📝 Examination Fee", price: "800" },
                { name: "💼 Consulting Retainer", price: "15000" },
                { name: "💻 Software / AMC", price: "10000" },
                { name: "📦 Product Sale", price: "" },
              ].map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="invoice-preset-btn"
                  onClick={() => applyPreset(preset.name, preset.price)}
                  title={`Add ${preset.name} with price`}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#1e3a8a",
                    fontSize: 11,
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  + {preset.name} {preset.price ? `(₹${Number(preset.price).toLocaleString("en-IN")})` : ""}
                </button>
              ))}
            </div>

            {/* Month-Wise Student Fees Selector Bar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 750, color: "#166534" }}>
                  📅 Select Month-Wise Student Fees (Session {new Date().getFullYear()}–{new Date().getFullYear() + 1}):
                </span>
                <span style={{ fontSize: 10.5, color: "#15803d", fontWeight: 600 }}>
                  Click month to add monthly fee row (₹3,500/mo)
                </span>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {[
                  "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"
                ].map((m) => {
                  const fullMonth = {
                    Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August",
                    Sep: "September", Oct: "October", Nov: "November", Dec: "December",
                    Jan: "January", Feb: "February", Mar: "March"
                  }[m] || m;
                  const year = ["Jan", "Feb", "Mar"].includes(m) ? new Date().getFullYear() + 1 : new Date().getFullYear();
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => applyMonthFee(fullMonth, year)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: "1px solid #86efac",
                        background: "#ffffff",
                        color: "#166534",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}
                      title={`Add fee bill for ${fullMonth} ${year}`}
                    >
                      + {m} {year}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                {[
                  { label: "Q1 (Apr–Jun)", name: "Q1 (Apr–Jun)" },
                  { label: "Q2 (Jul–Sep)", name: "Q2 (Jul–Sep)" },
                  { label: "Q3 (Oct–Dec)", name: "Q3 (Oct–Dec)" },
                  { label: "Q4 (Jan–Mar)", name: "Q4 (Jan–Mar)" },
                  { label: "Full Session 2026-27 (Annual)", name: "Annual Full Session 2026–27" },
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => applyQuarterFee(q.name)}
                    style={{
                      padding: "2px 7px",
                      borderRadius: 5,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: 10.5,
                      fontWeight: 650,
                      cursor: "pointer",
                    }}
                  >
                    + {q.label}
                  </button>
                ))}
              </div>
            </div>

            <datalist id="invoice-item-presets">
              {INVOICE_ITEM_PRESETS.map((preset) => (
                <option key={preset} value={preset} />
              ))}
            </datalist>

            <div className="invoice-items-table">
              <div className="invoice-items-header">
                <div>Item / Service / Fees / Salary</div>
                <div>Qty</div>
                <div>Price (₹)</div>
                <div>GST Rate</div>
                <div style={{ textAlign: "right", paddingRight: 4 }}>Amount (₹)</div>
                <div></div>
              </div>

              {formItems.map((item, idx) => {
                const lineAmount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                const lineTax = lineAmount * ((Number(item.taxRate) || 0) / 100);
                const lineTotal = lineAmount + lineTax;

                return (
                  <div key={idx} className="invoice-item-row">
                    <input
                      type="text"
                      list="invoice-item-presets"
                      placeholder="e.g. Tuition Fees, Salary, Consulting, Product SKU…"
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
                      placeholder="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...formItems];
                        const current = updated[idx];
                        if (current) {
                          current.quantity = e.target.value === "" ? "" : Number(e.target.value);
                          setFormItems(updated);
                        }
                      }}
                      required
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const updated = [...formItems];
                        const current = updated[idx];
                        if (current) {
                          current.unitPrice = e.target.value === "" ? "" : Number(e.target.value);
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
                      <option value="0">0% (Nil)</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST</option>
                      <option value="28">28% GST</option>
                    </select>
                    <div className="invoice-item-amount">
                      ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ color: formItems.length === 1 ? "#cbd5e1" : "#ef4444" }}
                      onClick={() => removeItemRow(idx)}
                      disabled={formItems.length === 1}
                      title="Remove item"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Grid: Notes & Summary Breakdown */}
          <div className="invoice-summary-grid">
            <div className="form-group" style={{ margin: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 750, color: "var(--ink)", margin: 0 }}>Payment Terms & Bank / UPI Notes</label>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setFormNotes("Bank: HDFC Bank | A/C: 50200012345678 | IFSC: HDFC0001234 | UPI: crmkaro@upi")}
                    style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", color: "var(--brand)" }}
                  >
                    + Bank/UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormNotes("Payment due upon receipt. Thank you for your business!")}
                    style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", color: "var(--brand)" }}
                  >
                    + Due Receipt
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                style={{ flex: 1, minHeight: 90, borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 12.5 }}
                placeholder="e.g. Payment due within 15 days. Bank details, UPI ID, or terms of service…"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>

            <div className="invoice-summary-card">
              <div className="invoice-summary-row">
                <span>Taxable Subtotal</span>
                <strong>₹{invoiceSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="invoice-summary-row">
                <span>Total GST / Tax</span>
                <strong>₹{invoiceTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="invoice-summary-total">
                <span>Grand Total</span>
                <span>₹{invoiceGrandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ margin: 0, marginTop: 8, padding: "14px 0 0 0", background: "transparent", borderTop: "1px solid var(--line)" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateInvoiceOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={invoiceBusy || !formPersonId || invoiceSubtotal <= 0}
              style={{ minWidth: 160 }}
            >
              {invoiceBusy ? "Creating Invoice…" : `Save Invoice Draft (₹${invoiceGrandTotal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })})`}
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
          {paymentError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {paymentError}
            </div>
          )}
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
        title="Record Business Expense (Kharcha)"
        subtitle="Track company operating costs like rent, staff stipends, electricity bills, software tools, and marketing ads"
        maxWidth={500}
      >
        <form onSubmit={handleRecordExpense} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {expError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {expError}
            </div>
          )}
          <div className="form-group">
            <label>Expense Category *</label>
            <select
              className="filter-select"
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
            >
              <option value="Office Rent & Maintenance">🏢 Office Rent & Maintenance</option>
              <option value="Staff Stipends & Daily Wages">👥 Staff Stipends & Daily Wages</option>
              <option value="Electricity & Utility Bills">⚡ Electricity & Utility Bills</option>
              <option value="Internet & Phone Bills">🌐 Internet & Telephone Bills</option>
              <option value="Marketing & Advertising (Ads)">📢 Marketing & Google/Meta Ads</option>
              <option value="Software Subscriptions & Tools">💻 Software Subscriptions & SaaS Tools</option>
              <option value="Office Supplies & Stationery">📦 Office Supplies & Stationery</option>
              <option value="Food, Tea & Refreshments">☕ Food, Tea & Refreshments</option>
              <option value="Travel, Fuel & Logistics">🚗 Travel, Fuel & Conveyance</option>
              <option value="Hardware & Equipment Purchase">🔧 Hardware & Equipment Purchase</option>
              <option value="Legal & Professional Fees">💼 Legal & Professional Fees</option>
              <option value="Other">🏷️ Other / Miscellaneous Kharcha</option>
            </select>
            {/* Quick Category Chips */}
            <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
              {[
                { label: "🏢 Rent", val: "Office Rent & Facility" },
                { label: "⚡ Electricity", val: "Electricity & Utility Bills" },
                { label: "📶 Wi-Fi", val: "Internet & Phone Bills" },
                { label: "📢 Ads", val: "Marketing & Advertising (Ads)" },
                { label: "☕ Tea/Food", val: "Food, Tea & Refreshments" },
                { label: "💻 Tools/SaaS", val: "Software Subscriptions & Tools" },
              ].map((cat) => (
                <button
                  key={cat.val}
                  type="button"
                  onClick={() => setExpCategory(cat.val)}
                  style={{
                    padding: "2px 7px",
                    borderRadius: 5,
                    border: "1px solid #cbd5e1",
                    background: expCategory === cat.val ? "#dbeafe" : "#ffffff",
                    color: expCategory === cat.val ? "#1d4ed8" : "#475569",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Vendor / Paid To</label>
            <input
              type="text"
              placeholder="e.g. Landlord Name, Google Ads, Airtel, Amazon, Vendor Name"
              value={expVendor}
              onChange={(e) => setExpVendor(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Amount Paid (₹) *</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 5000"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              required
            />
            {/* Quick Amount Chips */}
            <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
              {[500, 1000, 2500, 5000, 10000, 25000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setExpAmount(String(amt))}
                  style={{
                    padding: "2px 7px",
                    borderRadius: 5,
                    border: "1px solid #cbd5e1",
                    background: expAmount === String(amt) ? "#dbeafe" : "#ffffff",
                    color: expAmount === String(amt) ? "#1d4ed8" : "#475569",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ₹{amt.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
              <label style={{ margin: 0 }}>Expense Date *</label>
              <button
                type="button"
                onClick={() => setExpDate(new Date().toISOString().split("T")[0] || "")}
                style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", color: "var(--brand)" }}
              >
                Today
              </button>
            </div>
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
              placeholder="e.g. Office rent for August, Broadband recharge, Facebook ad campaign…"
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
              {expBusy ? "Recording…" : "Save Business Expense"}
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
          {refundError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {refundError}
            </div>
          )}
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

      {/* Toast Notification Feedback Card */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 18px",
            borderRadius: 12,
            background: toast.type === "success" ? "#0f172a" : "#991b1b",
            color: "#ffffff",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
            fontSize: 13.5,
            fontWeight: 600,
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#fff",
              borderRadius: 6,
              padding: "3px 8px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 750,
              marginLeft: 8,
            }}
          >
            OK
          </button>
        </div>
      )}
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

