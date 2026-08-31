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
import { authFetch, getApiUrl } from "@/lib/api";
import {
  buildNavItems,
  getCachedWorkspaceContext,
  saveCachedWorkspaceContext,
  saveActiveServicesToStorage,
} from "@/lib/nav";

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
  quantity: number | string;
  unitPriceMinor: number;
  discountMinor?: number;
  taxRateBps?: number;
  taxRateBasisPoints?: number;
  taxMinor?: number;
  lineTotalMinor?: number;
  totalMinor?: number;
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
  discountMinor?: number;
  taxMinor: number;
  grandTotalMinor?: number;
  totalMinor?: number;
  paidTotalMinor?: number;
  amountPaidMinor?: number;
  balanceDueMinor: number;
  notes: string | null;
  items?: InvoiceItem[];
  payments?: Payment[];
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
  if (amountMinor === undefined || amountMinor === null || isNaN(amountMinor)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function generateInvoiceShareText(inv: Invoice, orgName: string): string {
  const itemsText = (inv.items || [])
    .map(
      (it) =>
        `• ${it.description} (Qty: ${it.quantity}) — ${formatMoney(it.lineTotalMinor ?? (Number(it.quantity) * it.unitPriceMinor))}`,
    )
    .join("\n");

  return (
    `🧾 *INVOICE / BILL — ${orgName || "CRMKaro"}*\n\n` +
    `👤 *Customer / Student:* ${inv.person?.displayName || "—"}\n` +
    `📄 *Invoice No:* ${inv.invoiceNumber}\n` +
    `📅 *Date:* ${inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("en-IN") : "Today"}\n` +
    `⏰ *Due Date:* ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "Immediate / On Demand"}\n` +
    `📌 *Status:* ${inv.status}\n\n` +
    (itemsText ? `*Items / Services:*\n${itemsText}\n\n` : "") +
    `💰 *Total Amount:* ${formatMoney(inv.grandTotalMinor ?? inv.totalMinor ?? 0)}\n` +
    `✅ *Amount Paid:* ${formatMoney(inv.paidTotalMinor ?? inv.amountPaidMinor ?? 0)}\n` +
    `⏳ *Balance Due:* ${formatMoney(inv.balanceDueMinor ?? 0)}\n\n` +
    (inv.notes ? `*Notes:* ${inv.notes}\n\n` : "") +
    `Thank you! — *${orgName || "CRMKaro"}*`
  );
}

function printInvoiceHtml(invoice: Invoice, orgName: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to print invoices");
    return;
  }
  const itemsHtml = (invoice.items || [])
    .map(
      (it) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">${it.description}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.quantity}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatMoney(it.unitPriceMinor)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatMoney(it.lineTotalMinor ?? (Number(it.quantity) * it.unitPriceMinor))}</td>
    </tr>
  `,
    )
    .join("");

  const paymentsHtml = (invoice.payments || []).length > 0
    ? `
    <div style="margin-top: 24px;">
      <h3 style="font-size: 14px; color: #475569; margin-bottom: 8px;">Payment History</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 8px 12px; text-align: left;">Date</th>
            <th style="padding: 8px 12px; text-align: left;">Method</th>
            <th style="padding: 8px 12px; text-align: left;">Reference</th>
            <th style="padding: 8px 12px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.payments || [])
            .map(
              (p) => `
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${new Date(p.createdAt).toLocaleDateString("en-IN")}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${p.method}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${p.reference || "—"}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #16a34a;">${formatMoney(p.amountMinor)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice - ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2457D6; padding-bottom: 20px; margin-bottom: 24px; }
          .org-title { font-size: 24px; font-weight: 800; color: #2457D6; margin: 0; }
          .inv-badge { font-size: 14px; font-weight: 700; background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 6px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
          .info-block h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
          .info-block p { margin: 2px 0; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f8fafc; padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
          .totals { margin-top: 24px; width: 280px; margin-left: auto; }
          .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
          .totals-grand { display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; margin-top: 6px; }
          .totals-due { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; font-weight: 700; color: #dc2626; border-top: 1px solid #fee2e2; margin-top: 4px; }
          .footer { margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 12px; color: #94a3b8; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="org-title">${orgName || "CRMKaro"}</h1>
            <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Official Tax Invoice & Bill</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 22px; font-weight: 900; color: #0f172a;">${invoice.invoiceNumber}</div>
            <span class="inv-badge">${invoice.status}</span>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-block">
            <h4>Billed To (Customer / Student)</h4>
            <p style="font-weight: 700; font-size: 15px;">${invoice.person?.displayName || "—"}</p>
            ${invoice.person?.primaryPhone ? `<p>📞 ${invoice.person.primaryPhone}</p>` : ""}
            ${invoice.person?.email ? `<p>✉️ ${invoice.person.email}</p>` : ""}
          </div>
          <div class="info-block" style="text-align: right;">
            <h4>Invoice Dates</h4>
            <p><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString("en-IN")}</p>
            <p><strong>Due Date:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "Immediate / On Demand"}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Item Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>${formatMoney(invoice.subtotalMinor)}</span>
          </div>
          ${(invoice.taxMinor || 0) > 0 ? `
          <div class="totals-row">
            <span>GST / Tax:</span>
            <span>${formatMoney(invoice.taxMinor)}</span>
          </div>` : ""}
          <div class="totals-grand">
            <span>Grand Total:</span>
            <span>${formatMoney(invoice.grandTotalMinor ?? invoice.totalMinor ?? 0)}</span>
          </div>
          <div class="totals-row">
            <span>Amount Paid:</span>
            <span style="color: #16a34a; font-weight: 600;">${formatMoney(invoice.paidTotalMinor ?? invoice.amountPaidMinor ?? 0)}</span>
          </div>
          <div class="totals-due">
            <span>Balance Due:</span>
            <span>${formatMoney(invoice.balanceDueMinor ?? 0)}</span>
          </div>
        </div>

        ${paymentsHtml}

        ${invoice.notes ? `
          <div style="margin-top: 24px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 12px; color: #475569;">
            <strong style="display: block; margin-bottom: 4px; color: #1e293b;">Notes / Terms:</strong>
            ${invoice.notes}
          </div>
        ` : ""}

        <div class="footer">
          Thank you for choosing ${orgName || "our services"}! Generated via CRMKaro.com
        </div>
      </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}

function FinanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = getApiUrl();

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

  // Context & AppShell info (Instant 0ms cached state)
  const cached = getCachedWorkspaceContext();
  const [orgName, setOrgName] = useState(cached.orgName);
  const [userName, setUserName] = useState(cached.userName);
  const [userRole, setUserRole] = useState(cached.userRole);
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);
  const [activeServiceCodes, setActiveServiceCodes] = useState<string[]>(cached.activeServices);

  // Modals & Drawers
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [createExpenseOpen, setCreateExpenseOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<Payment | null>(null);

  // Form states - Create / Edit Invoice
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
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

  // Share Bill Modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareInvoice, setShareInvoice] = useState<Invoice | null>(null);

  // Toast notification feedback state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }

  async function handleOpenDetailInvoice(inv: Invoice) {
    setDetailInvoice(inv);
    try {
      const res = await authFetch(`${api}/finance/invoices/${inv.id}`);
      if (res.ok) {
        const full = await res.json();
        setDetailInvoice(full);
      }
    } catch {
      // ignore
    }
  }

  async function handleDownloadPdf(invoiceId: string, invoiceNumber: string) {
    setDownloadingPdf(true);
    try {
      const res = await authFetch(`${api}/finance/invoices/${invoiceId}/pdf`);
      if (!res.ok) throw new Error("Could not generate invoice PDF.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(`Invoice ${invoiceNumber} downloaded successfully!`, "success");
    } catch (err) {
      showToast("Download failed: " + (err as Error).message, "error");
    } finally {
      setDownloadingPdf(false);
    }
  }

  function cleanUrlParams() {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (
        url.searchParams.has("action") ||
        url.searchParams.has("invoiceId") ||
        url.searchParams.has("personId") ||
        url.searchParams.has("description") ||
        url.searchParams.has("price")
      ) {
        url.searchParams.delete("action");
        url.searchParams.delete("invoiceId");
        url.searchParams.delete("personId");
        url.searchParams.delete("description");
        url.searchParams.delete("price");
        const newSearch = url.searchParams.toString();
        window.history.replaceState({}, "", url.pathname + (newSearch ? `?${newSearch}` : ""));
      }
    }
  }

  // Load session context
  const loadContext = useCallback(async () => {
    try {
      const meRes = await authFetch(`${api}/auth/me`, { credentials: "include" });
      if (meRes.status === 401) {
        router.replace("/login");
        return;
      }
      const orgsRes = await authFetch(`${api}/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgList = await orgsRes.json();
        const activeOrgEntry = orgList.find(
          (o: { organisation: { id: string; name: string } | null; role: { name: string } }) =>
            o.organisation,
        );
        if (activeOrgEntry?.organisation) {
          setOrgName(activeOrgEntry.organisation.name);
          setUserRole(activeOrgEntry.role?.name || "Accountant");
          const srvs = activeOrgEntry.activeServices || activeOrgEntry.organisation.activeServices;
          if (srvs && Array.isArray(srvs)) {
            setActiveServiceCodes(srvs);
            saveActiveServicesToStorage(srvs);
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

  // Load people for dropdown (Excluding employees)
  const loadPeople = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/people?excludeType=EMPLOYEE&limit=100`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPeople(data.items || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  // Load Expenses
  const loadExpenses = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/finance/expenses`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data || []);
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
      const res = await authFetch(`${api}/finance/invoices?${params.toString()}`, { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load invoices.");
      const data = await res.json();
      setInvoices(data.items || []);
      // Also sync expenses in background for accurate metrics
      loadExpenses();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, invoiceStatusFilter, router, loadExpenses]);

  useEffect(() => {
    loadContext();
    loadPeople();
    loadExpenses();
  }, [loadContext, loadPeople, loadExpenses]);

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
      authFetch(`${api}/finance/invoices/${invoiceId}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((inv) => {
          if (inv) setDetailInvoice(inv);
        })
        .catch(() => {});
    }
  }, [searchParams, api]);

  // Debounced live search for customers/students when creating invoice (Excluding employees)
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
          `${api}/people?excludeType=EMPLOYEE&search=${encodeURIComponent(personSearchQuery.trim())}&limit=50`,
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

  // Helper to ensure contacts are customer/student/member and not exclusively employee
  const isCustomerOrStudent = (p: PersonOption) => {
    if (!p.types || p.types.length === 0) return true;
    const typeCodes = p.types.map((t) => t.type);
    if (typeCodes.includes("EMPLOYEE") && !typeCodes.some((t) => ["CUSTOMER", "STUDENT", "MEMBER"].includes(t))) {
      return false;
    }
    return true;
  };

  // Calculate metrics
  const totalBilledMinor = invoices.reduce(
    (acc, inv) => acc + (inv.grandTotalMinor ?? inv.totalMinor ?? 0),
    0,
  );
  const totalPaidMinor = invoices.reduce(
    (acc, inv) => acc + (inv.paidTotalMinor ?? inv.amountPaidMinor ?? 0),
    0,
  );
  const totalBalanceDueMinor = invoices
    .filter((inv) => inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID")
    .reduce((acc, inv) => acc + (inv.balanceDueMinor ?? 0), 0);
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

  async function handleSaveInvoice(e: FormEvent) {
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
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPriceMinor: Math.max(0, Math.round(Number(item.unitPrice) * 100) || 0),
        discountMinor: 0,
        taxRateBps: Math.max(0, Math.round(Number(item.taxRate) * 100) || 0),
      }));

      const todayStr = new Date().toISOString().slice(0, 10);
      const issueDate = todayStr;
      const dueDate = formDueDate && formDueDate >= todayStr ? formDueDate : todayStr;

      let res;
      if (editingInvoiceId) {
        res = await authFetch(`${api}/finance/invoices/${editingInvoiceId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            personId: formPersonId,
            dueDate,
            notes: formNotes?.trim() || undefined,
            items: itemsPayload,
          }),
        });
      } else {
        res = await authFetch(`${api}/finance/invoices`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            personId: formPersonId,
            issueDate,
            dueDate,
            notes: formNotes?.trim() || undefined,
            items: itemsPayload,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        let errMsg =
          data.message ||
          (editingInvoiceId ? "Failed to update invoice." : "Failed to create invoice.");
        if (data.fields && typeof data.fields === "object") {
          const fieldMsgs = Object.entries(data.fields)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : errs}`)
            .join("; ");
          if (fieldMsgs) errMsg = `${errMsg} (${fieldMsgs})`;
        }
        throw new Error(errMsg);
      }
      setCreateInvoiceOpen(false);
      setEditingInvoiceId(null);
      cleanUrlParams();
      loadInvoices();
      loadExpenses();
      if (detailInvoice && editingInvoiceId === detailInvoice.id) {
        setDetailInvoice(data);
      }
      showToast(
        editingInvoiceId
          ? "Invoice / Fee Bill updated successfully!"
          : "Invoice / Fee Bill created successfully!",
        "success",
      );
    } catch (err) {
      setInvoiceError((err as Error).message);
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function handleIssueInvoice(invoiceId: string) {
    try {
      const res = await authFetch(`${api}/finance/invoices/${invoiceId}/issue`, {
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
      const res = await authFetch(`${api}/finance/invoices/${invoiceId}/void`, {
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
      const res = await authFetch(`${api}/finance/invoices/${detailInvoice.id}/payments`, {
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
      const invRes = await authFetch(`${api}/finance/invoices/${detailInvoice.id}`, { credentials: "include" });
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
      const res = await authFetch(`${api}/finance/payments/${selectedPaymentForRefund.id}/refund`, {
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

      const res = await authFetch(`${api}/finance/expenses`, {
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
      cleanUrlParams();
      setExpVendor("");
      setExpAmount("");
      setExpDesc("");
      setActiveTab("expenses");
      loadExpenses();
      showToast(`Business expense of ₹${amt.toLocaleString("en-IN")} recorded successfully!`, "success");
    } catch (err) {
      setExpError((err as Error).message);
    } finally {
      setExpBusy(false);
    }
  }

  function openCreateInvoiceModal(presetPersonId?: string, presetDesc?: string, presetPrice?: string) {
    setEditingInvoiceId(null);
    const randomNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormInvoiceNumber(randomNum);
    setFormPersonId(presetPersonId || "");
    setPersonSearchQuery("");
    setSearchResults([]);
    setIsCustomerDropdownOpen(false);
    setFormDueDate("");
    setFormNotes("");
    setFormItems([{ description: presetDesc || "", quantity: 1, unitPrice: presetPrice || "", taxRate: 0 }]);
    setInvoiceError("");
    setCreateInvoiceOpen(true);
  }

  function openEditInvoiceModal(inv: Invoice) {
    setEditingInvoiceId(inv.id);
    setFormInvoiceNumber(inv.invoiceNumber);
    setFormPersonId(inv.personId);
    setPersonSearchQuery("");
    setSearchResults([]);
    setIsCustomerDropdownOpen(false);
    setFormDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().split("T")[0] || "" : "");
    setFormNotes(inv.notes || "");
    const loadedItems =
      inv.items && inv.items.length > 0
        ? inv.items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity) || 1,
            unitPrice: String((it.unitPriceMinor ?? 0) / 100),
            taxRate: (it.taxRateBps ?? it.taxRateBasisPoints ?? 0) / 100,
          }))
        : [{ description: "", quantity: 1, unitPrice: "", taxRate: 0 }];
    setFormItems(loadedItems);
    setInvoiceError("");
    setCreateInvoiceOpen(true);
  }

  function addItemRow() {
    setFormItems([...formItems, { description: "", quantity: 1, unitPrice: "", taxRate: 0 }]);
  }

  function applyPreset(presetText: string, defaultPrice: string = "") {
    if (formItems.length === 1 && !formItems[0]?.description.trim()) {
      setFormItems([{ description: presetText, quantity: 1, unitPrice: defaultPrice || formItems[0]?.unitPrice || "", taxRate: 0 }]);
    } else {
      setFormItems([...formItems, { description: presetText, quantity: 1, unitPrice: defaultPrice, taxRate: 0 }]);
    }
  }

  function applyMonthFee(monthName: string, year: number = new Date().getFullYear()) {
    const feeDesc = `🎓 Monthly Academic / Tuition Fees — ${monthName} ${year}`;
    applyPreset(feeDesc, "");
  }

  function applyQuarterFee(quarterName: string, year: number = new Date().getFullYear()) {
    const feeDesc = `🎓 Quarterly Academic Fees — ${quarterName} ${year}`;
    applyPreset(feeDesc, "");
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

  const eligiblePeople = people.filter(isCustomerOrStudent);
  const eligibleSearchResults = searchResults.filter(isCustomerOrStudent);

  const selectedPerson =
    eligiblePeople.find((p) => p.id === formPersonId) ||
    eligibleSearchResults.find((p) => p.id === formPersonId);

  const displayedPeople = personSearchQuery.trim()
    ? eligibleSearchResults.length > 0
      ? eligibleSearchResults
      : eligiblePeople.filter((p) => {
          const q = personSearchQuery.toLowerCase();
          return (
            p.displayName.toLowerCase().includes(q) ||
            (p.email && p.email.toLowerCase().includes(q)) ||
            (p.primaryPhone && p.primaryPhone.includes(q))
          );
        })
    : eligiblePeople.slice(0, 40);

  const tabItems = [
    { id: "invoices", label: "Invoices & Student Fees", count: invoices.length },
    { id: "payments", label: "Fee Collections & Receipts", count: allPayments.length },
    { id: "expenses", label: "Kharcha / Expenses", count: expenses.length },
  ];

  const nav: NavItem[] = buildNavItems(activeServiceCodes);

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
      onNavigate={(href) => router.push(href)}
      onPrefetch={(href) => router.prefetch(href)}
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
                      onClick={() => handleOpenDetailInvoice(inv)}
                    >
                      <td>
                        <strong>{inv.invoiceNumber}</strong>
                      </td>
                      <td>{inv.person?.displayName || "—"}</td>
                      <td>{new Date(inv.issueDate).toLocaleDateString()}</td>
                      <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                      <td>
                        <strong>{formatMoney(inv.grandTotalMinor ?? inv.totalMinor ?? 0)}</strong>
                      </td>
                      <td>
                        <span style={{ color: (inv.balanceDueMinor ?? 0) > 0 ? "var(--danger)" : "var(--ink)", fontWeight: 600 }}>
                          {formatMoney(inv.balanceDueMinor ?? 0)}
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
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {inv.status === "DRAFT" && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditInvoiceModal(inv)}
                              title="Edit Draft Bill"
                              style={{ color: "var(--brand)", borderColor: "var(--line)" }}
                            >
                              <Icon name="edit" size={14} />
                              <span>Edit</span>
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenDetailInvoice(inv)}
                          >
                            <Icon name="eye" size={14} />
                            <span>View</span>
                          </button>
                        </div>
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
            {/* Top Stat Badge in Drawer */}
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
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>
                  {formatMoney(detailInvoice.grandTotalMinor ?? detailInvoice.totalMinor ?? 0)}
                </div>
                <small style={{ color: (detailInvoice.balanceDueMinor ?? 0) > 0 ? "var(--danger)" : "#15803d", fontWeight: 600 }}>
                  Balance Due: {formatMoney(detailInvoice.balanceDueMinor ?? 0)}
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {detailInvoice.status === "DRAFT" && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEditInvoiceModal(detailInvoice)}
                    style={{ borderColor: "var(--brand)", color: "var(--brand)", fontWeight: 600 }}
                  >
                    <Icon name="edit" size={14} />
                    <span>Edit Draft Bill</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleIssueInvoice(detailInvoice.id)}
                  >
                    <Icon name="check" size={14} />
                    <span>Issue & Finalize</span>
                  </button>
                </>
              )}
              {(detailInvoice.status === "ISSUED" || detailInvoice.status === "PARTIALLY_PAID") && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setPaymentAmount(((detailInvoice.balanceDueMinor ?? 0) / 100).toString());
                    setRecordPaymentOpen(true);
                  }}
                  style={{ background: "#16a34a", borderColor: "#15803d" }}
                >
                  <Icon name="rupee" size={14} />
                  <span>
                    {detailInvoice.status === "PARTIALLY_PAID"
                      ? `Collect Next Installment (Due: ${formatMoney(detailInvoice.balanceDueMinor)})`
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

              {/* Share & Send Options */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShareInvoice(detailInvoice);
                  setShareModalOpen(true);
                }}
                style={{ color: "#0369a1", borderColor: "#bae6fd", background: "#f0f9ff", fontWeight: 600 }}
              >
                <Icon name="whatsapp" size={14} />
                <span>Send / Share Bill</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDownloadPdf(detailInvoice.id, detailInvoice.invoiceNumber)}
                disabled={downloadingPdf}
              >
                <Icon name="download" size={14} />
                <span>{downloadingPdf ? "Downloading…" : "Download PDF"}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => printInvoiceHtml(detailInvoice, orgName)}
              >
                <Icon name="externalLink" size={14} />
                <span>Print Invoice</span>
              </button>
              {detailInvoice.person?.email && (
                <a
                  href={`mailto:${detailInvoice.person.email}?subject=${encodeURIComponent(`Invoice ${detailInvoice.invoiceNumber} from ${orgName || "CRMKaro"}`)}&body=${encodeURIComponent(generateInvoiceShareText(detailInvoice, orgName))}`}
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: "none" }}
                >
                  <Icon name="mail" size={14} />
                  <span>Email to Client</span>
                </a>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(generateInvoiceShareText(detailInvoice, orgName));
                  showToast("Invoice summary copied to clipboard!", "success");
                }}
              >
                <Icon name="copy" size={14} />
                <span>Copy Text</span>
              </button>

              {detailInvoice.status !== "VOID" && detailInvoice.status !== "PAID" && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleVoidInvoice(detailInvoice.id)}
                >
                  <Icon name="close" size={14} />
                  <span>Void</span>
                </button>
              )}
            </div>

            {/* Key Value Details */}
            <div className="key-value-list">
              <div className="key-value-item">
                <label>Customer / Student</label>
                <span>{detailInvoice.person?.displayName || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Phone Number</label>
                <span>{detailInvoice.person?.primaryPhone || "—"}</span>
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
                  {detailInvoice.dueDate ? new Date(detailInvoice.dueDate).toLocaleDateString() : "Immediate / On Demand"}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>
                  Line Items ({detailInvoice.items?.length || 0})
                </label>
                {detailInvoice.status === "DRAFT" && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: "2px 8px", height: 26 }}
                    onClick={() => openEditInvoiceModal(detailInvoice)}
                  >
                    <Icon name="edit" size={12} />
                    <span>Edit Items</span>
                  </button>
                )}
              </div>
              <table className="data-table" style={{ border: "1px solid var(--line)", borderRadius: 8 }}>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th style={{ textAlign: "center" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Unit Price</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailInvoice.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 12 }}>
                        No line items found.
                      </td>
                    </tr>
                  ) : (
                    (detailInvoice.items || []).map((it, i) => (
                      <tr key={i}>
                        <td>{it.description}</td>
                        <td style={{ textAlign: "center" }}>{it.quantity}</td>
                        <td style={{ textAlign: "right" }}>{formatMoney(it.unitPriceMinor)}</td>
                        <td style={{ textAlign: "right" }}>
                          <strong>{formatMoney(it.lineTotalMinor ?? it.totalMinor ?? (Number(it.quantity) * it.unitPriceMinor))}</strong>
                        </td>
                      </tr>
                    ))
                  )}
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
                  {(detailInvoice.payments || []).map((p) => (
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

      {/* Create / Edit Invoice Modal */}
      <Modal
        isOpen={createInvoiceOpen}
        onClose={() => {
          setCreateInvoiceOpen(false);
          setEditingInvoiceId(null);
        }}
        title={editingInvoiceId ? "Edit Draft Invoice" : "Create New Invoice"}
        subtitle={
          editingInvoiceId
            ? `Modify items, prices, quantities, dates or customer for ${formInvoiceNumber}`
            : "Generate & issue itemized tax-compliant invoice with automatic GST calculation"
        }
        maxWidth={860}
      >
        <form onSubmit={handleSaveInvoice} className="invoice-modal-body">
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
                "🎓 Full Course Fees",
                "📝 Admission / Reg. Fee",
                "📚 Books & Materials Kit",
                "📝 Examination Fee",
                "💼 Consulting Retainer",
                "💻 Software / AMC",
                "📦 Product Sale",
              ].map((name) => (
                <button
                  key={name}
                  type="button"
                  className="invoice-preset-btn"
                  onClick={() => applyPreset(name, "")}
                  title={`Add ${name}`}
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
                  + {name}
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
                  Click month to add fee item row
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
                      <option value="0">0% (No GST)</option>
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
              onClick={() => {
                setCreateInvoiceOpen(false);
                setEditingInvoiceId(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={invoiceBusy || !formPersonId || invoiceSubtotal <= 0}
              style={{ minWidth: 160 }}
            >
              {invoiceBusy
                ? (editingInvoiceId ? "Updating Invoice…" : "Creating Invoice…")
                : (editingInvoiceId
                    ? `Update Draft Bill (₹${invoiceGrandTotal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })})`
                    : `Save Invoice Draft (₹${invoiceGrandTotal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })})`)}
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
      {/* Share Bill / Receipt Modal */}
      {shareModalOpen && shareInvoice && (
        <div className="modal-scrim" onClick={() => setShareModalOpen(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: 520, borderRadius: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, margin: 0 }}>
                  <Icon name="whatsapp" size={20} />
                  <span>Share Fee Bill / Receipt</span>
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  Share directly with {shareInvoice.person?.displayName || "Student / Customer"} on WhatsApp or copy receipt text
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShareModalOpen(false)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Receipt Preview Box */}
              <div
                style={{
                  background: "#f8fafc",
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                  color: "#1e293b",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {generateInvoiceShareText(shareInvoice, orgName)}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a
                  href={`https://wa.me/${shareInvoice.person?.primaryPhone?.replace(/[^0-9]/g, "") || ""}?text=${encodeURIComponent(
                    generateInvoiceShareText(shareInvoice, orgName),
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ background: "#25D366", borderColor: "#128C7E", color: "#fff", display: "flex", justifyContent: "center", gap: 8 }}
                >
                  <Icon name="whatsapp" size={16} />
                  <span>Send on WhatsApp</span>
                </a>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      navigator.clipboard.writeText(generateInvoiceShareText(shareInvoice, orgName));
                      showToast("Invoice bill text copied to clipboard!", "success");
                    }}
                  >
                    <Icon name="copy" size={14} />
                    <span>Copy Text</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => handleDownloadPdf(shareInvoice.id, shareInvoice.invoiceNumber)}
                    disabled={downloadingPdf}
                  >
                    <Icon name="download" size={14} />
                    <span>{downloadingPdf ? "Downloading…" : "Download PDF"}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => printInvoiceHtml(shareInvoice, orgName)}
                  >
                    <Icon name="externalLink" size={14} />
                    <span>Print</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
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

