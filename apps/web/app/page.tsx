"use client";

export const dynamic = "force-dynamic";

import {
  AppShell,
  Badge,
  Icon,
  SectionCard,
  StatCard,
  type IconName,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import {
  ALL_AVAILABLE_SERVICES,
  SERVICE_NAV_MAP,
  buildNavItems,
  useWorkspaceContext,
  getCachedWorkspaceContext,
  saveCachedWorkspaceContext,
  saveActiveServicesToStorage,
} from "@/lib/nav";

type Dashboard = {
  organisation: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    businessType?: string;
    createdAt?: string;
  };
  user: { name: string | null; email: string; isNewUser?: boolean };
  role: { name: string; code: string } | null;
  services: string[];
  cards: Array<{
    key: string;
    label: string;
    value: number;
    detail: string;
    format: "number" | "money";
    tone?: "blue" | "emerald" | "amber" | "rose" | "purple" | "teal";
  }>;
  notifications: Array<{
    id: string;
    module: string;
    title: string;
    detail: string;
    severity: "info" | "warning" | "critical";
    actionLabel?: string;
    actionHref?: string;
  }>;
  transactions?: Array<{
    id: string;
    receiptNumber: string;
    personName: string;
    invoiceNumber: string;
    amountMinor: number;
    method: string;
    receivedAt: string;
  }>;
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    metadata?: any;
  }>;
  generatedAt: string;
};

type OrganisationEntry = {
  organisation: { id: string; name: string; businessType?: string; activeServices?: string[] } | null;
  role?: { name: string; code?: string };
  activeServices?: string[];
};

const icons: Record<string, IconName> = {
  total_members: "people",
  total_received: "finance",
  total_due: "finance",
  active_groups: "activity",
  students: "student",
  students_fees: "finance",
  students_attendance: "calendar",
  people: "people",
  crm: "crm",
  finance: "finance",
  payroll: "payroll",
  inventory: "inventory",
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  let timeStr = "Good morning";
  if (hour >= 12 && hour < 17) timeStr = "Good afternoon";
  else if (hour >= 17) timeStr = "Good evening";
  return `${timeStr}, ${name}`;
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "Recently";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function humanizeAction(action: string): string {
  switch (action) {
    case "student.admitted":
      return "Student Admitted";
    case "student.fee_paid":
      return "Fee Payment Collected";
    case "student.updated":
      return "Student Profile Updated";
    case "attendance.batch_recorded":
      return "Daily Attendance Marked";
    case "person.created":
      return "New Contact Added";
    case "person.archived":
      return "Contact Archived";
    case "lead.created":
      return "New Lead Created";
    case "invoice.created":
      return "Invoice Issued";
    case "payment.created":
    case "payment.recorded":
      return "Payment Recorded";
    case "inventory.product_created":
      return "Product Added to Catalog";
    case "payroll.run_created":
      return "Monthly Payroll Created";
    default:
      return action.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function getCachedDashboardData(): Dashboard | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("crmkaro_dashboard_cache");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveCachedDashboardData(d: Dashboard) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("crmkaro_dashboard_cache", JSON.stringify(d));
  } catch {}
}

function DashboardLoading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface, #f8fafc)",
        gap: 16,
      }}
      aria-live="polite"
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "#ffffff",
          boxShadow: "0 10px 25px -5px rgba(37,99,235,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <img
          src="/brand/crmkaro-mark.png"
          alt="CRMKaro"
          style={{ width: 36, height: 36, objectFit: "contain" }}
        />
        <div
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: 20,
            border: "2px solid #3b82f6",
            borderTopColor: "transparent",
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink, #0f172a)", margin: 0 }}>
          Loading your workspace…
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted, #64748b)", marginTop: 4, margin: 0 }}>
          Connecting to CRMKaro Cloud
        </p>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

const BUSINESS_TYPE_OPTIONS = [
  "Beauty, Salon & Spa",
  "Coaching & Education Institute",
  "Real Estate & Property Consulting",
  "Healthcare, Clinic & Diagnostic",
  "Automotive & Dealership",
  "Software, IT & SaaS Agency",
  "Retail & E-commerce Store",
  "Restaurant, Cafe & Hospitality",
  "Manufacturing & Distribution",
  "Financial & Legal Consulting",
  "Event Management & Wedding Planning",
  "Fitness, Gym & Sports Club",
  "Construction & Interior Design",
  "Logistics, Transport & Supply Chain",
  "Trading & Wholesale",
  "Marketing & Advertising Agency",
  "Other",
];

const SOLUTION_PRESETS = [
  {
    id: "academy",
    name: "Academy, Classes & Studios",
    subtitle: "Dance Studios, Fitness & Gym, Yoga, Music, Martial Arts, Tuition Batches",
    tags: "Dance Studios, Fitness & Gym, Yoga, Music, Martial Arts, Tuition Batches",
    detail: "Members directory, batches, 1-click WhatsApp fees collect, transaction receipts & staff salary.",
    modules: ["people", "groups", "quick-collect", "transactions", "payroll", "finance"],
    badges: ["Members", "Groups & Batches", "Quick Collect", "Transactions", "Staff & Salary"],
    isPopular: true,
  },
  {
    id: "school",
    name: "Schools, Colleges & Formal Institutes",
    subtitle: "Schools, Junior Colleges, Degree Institutes, Formal Academies",
    detail: "Formal student admissions, standard & division, daily attendance register, fees & salary.",
    modules: ["students", "people", "groups", "finance", "payroll"],
    badges: ["Students Admission", "Members", "Groups", "Attendance", "Finance & Fees", "Staff & Salary"],
  },
  {
    id: "crm",
    name: "Sales, Leads & Real Estate CRM",
    subtitle: "Real Estate Brokers, Agencies, Consultants, Deal Pipelines",
    detail: "Visual deal pipelines, stage management, client follow-up reminders, and invoicing.",
    modules: ["people", "crm", "finance", "payroll"],
    badges: ["Contacts", "Leads & CRM", "Follow-ups", "Invoices", "Staff & Salary"],
  },
  {
    id: "retail",
    name: "Retail, Trading & Inventory",
    subtitle: "Shops, Wholesalers, Distributors, Dealerships",
    detail: "Product catalog, inventory stock movements, ledger, invoices, and staff compensation.",
    modules: ["people", "inventory", "finance", "payroll"],
    badges: ["Customers", "Inventory & Stock", "Invoices", "Staff & Salary"],
  },
] as const;function getDateBoundsForPreset(
  preset: string,
  customStart?: string,
  customEnd?: string,
): { startDate?: string; endDate?: string; label: string } {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (preset === "today") {
    return { startDate: todayStr, endDate: todayStr, label: "Today" };
  }
  if (preset === "this_week") {
    const current = new Date();
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));
    const startStr = monday.toISOString().slice(0, 10);
    return { startDate: startStr, endDate: todayStr, label: "This Week" };
  }
  if (preset === "this_month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    return { startDate: startOfMonth, endDate: todayStr, label: "This Month" };
  }
  if (preset === "last_month") {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    return { startDate: startOfLastMonth, endDate: endOfLastMonth, label: "Last Month" };
  }
  if (preset === "custom" && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd, label: `${customStart} to ${customEnd}` };
  }
  return { label: "All Time" };
}

export default function HomePage() {
  const router = useRouter();
  const { context: cachedContext, isMounted, nav: defaultNav } = useWorkspaceContext();
  const [data, setData] = useState<Dashboard | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);
  const [error, setError] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [organisationName, setOrganisationName] = useState("");
  const [selectedBusinessType, setSelectedBusinessType] = useState("");
  const [customBusinessType, setCustomBusinessType] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("academy");
  const [selectedServices, setSelectedServices] = useState<string[]>([
    "people",
    "groups",
    "quick-collect",
    "transactions",
    "payroll",
  ]);
  const [showAdvancedModules, setShowAdvancedModules] = useState<boolean>(false);
  const [groupsList, setGroupsList] = useState<any[]>([]);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState("");

  // Date Range Filter States
  const [datePreset, setDatePreset] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(false);

  const api = getApiUrl();

  function handleSelectPreset(preset: (typeof SOLUTION_PRESETS)[number]) {
    setSelectedPresetId(preset.id);
    setSelectedServices([...preset.modules]);
  }

  const loadDashboard = useCallback(
    async (preset = "all", start = "", end = "") => {
      const { startDate, endDate } = getDateBoundsForPreset(preset, start, end);
      let url = `${api}/dashboard`;
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const response = await authFetch(url);
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        const organisationsResponse = await authFetch(`${api}/organisations`);
        if (organisationsResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (!organisationsResponse.ok)
          throw new Error("Your workspace could not be loaded.");
        const orgs =
          (await organisationsResponse.json()) as OrganisationEntry[];
        const firstOrganisation = orgs.find(
          ({ organisation }) => organisation,
        )?.organisation;
        if (!firstOrganisation) {
          setNeedsSetup(true);
          return;
        }
        const activateResponse = await authFetch(
          `${api}/organisations/${firstOrganisation.id}/activate`,
          { method: "POST" },
        );
        if (!activateResponse.ok)
          throw new Error("Could not switch to your active workspace.");
        const retry = await authFetch(url);
        if (!retry.ok) throw new Error("Could not load your workspace summary.");
        const retryData = (await retry.json()) as Dashboard;
        setData(retryData);
        if (preset === "all") saveCachedDashboardData(retryData);
        saveActiveServicesToStorage(retryData.services || []);

        // Also load groups
        try {
          const gRes = await authFetch(`${api}/groups?limit=30`);
          if (gRes.ok) {
            const gData = await gRes.json();
            setGroupsList(gData.items || []);
          }
        } catch {}
        return;
      }

      if (!response.ok)
        throw new Error(
          "Could not load your workspace overview. Please try again.",
        );
      const dashboardData = (await response.json()) as Dashboard;
      setData(dashboardData);
      if (preset === "all") saveCachedDashboardData(dashboardData);
      saveActiveServicesToStorage(dashboardData.services || []);
      saveCachedWorkspaceContext({
        orgName: dashboardData.organisation.name,
        userName: dashboardData.user?.name || undefined,
        currency: dashboardData.organisation.currency || "INR",
        activeServices: dashboardData.services || [],
      });

      // Also load groups for Today's Batches widget
      try {
        const gRes = await authFetch(`${api}/groups?limit=30`);
        if (gRes.ok) {
          const gData = await gRes.json();
          setGroupsList(gData.items || []);
        }
      } catch {}

      const orgsRes = await authFetch(`${api}/organisations`);
      if (orgsRes.ok) {
        const orgList = await orgsRes.json();
        setOrganisations(
          orgList
            .map((o: { organisation: { id: string; name: string; businessType?: string } }) => o.organisation)
            .filter(Boolean),
        );
      }
    },
    [api, router],
  );

  async function handlePresetChange(preset: string) {
    setDatePreset(preset);
    if (preset !== "custom") {
      setDashboardLoading(true);
      try {
        await loadDashboard(preset, customStartDate, customEndDate);
      } finally {
        setDashboardLoading(false);
      }
    }
  }

  async function handleApplyCustomDate() {
    if (!customStartDate || !customEndDate) return;
    setDashboardLoading(true);
    try {
      await loadDashboard("custom", customStartDate, customEndDate);
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    const cached = getCachedDashboardData();
    if (cached) {
      setData(cached);
    }
    loadDashboard("all").catch((reason: Error) => setError(reason.message));
  }, [loadDashboard]);

  async function handleSwitchOrg(orgId: string) {
    try {
      const res = await authFetch(`${api}/organisations/${orgId}/activate`, {
        method: "POST",
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // ignore
    }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const effectiveBusinessType =
      selectedBusinessType === "Other"
        ? customBusinessType.trim()
        : selectedBusinessType;

    if (!effectiveBusinessType) {
      setSetupError("Please select or enter your business type.");
      return;
    }

    setSetupBusy(true);
    setSetupError("");
    try {
      const response = await authFetch(`${api}/organisations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: organisationName.trim(),
          businessType: effectiveBusinessType,
          timezone: "Asia/Kolkata",
          currency: "INR",
          serviceCodes: selectedServices,
        }),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok)
        throw new Error(body.message ?? "Workspace setup failed.");
      setNeedsSetup(false);
      await loadDashboard();
    } catch (reason) {
      setSetupError((reason as Error).message);
    } finally {
      setSetupBusy(false);
    }
  }

  if (needsSetup)
    return (
      <main className="onboarding-page">
        <section className="onboarding-card">
          <div className="onboarding-intro">
            <div>
              <span className="onboarding-mark" aria-hidden="true" />
              <p className="eyebrow" style={{ color: "#059669" }}>First Workspace Setup</p>
              <h1>Let’s set up your business.</h1>
              <p>
                Choose your solution package. CRMKaro will automatically configure your navigation, rosters, and ledger workflows.
              </p>
            </div>

            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 10 }}>✓</span>
                <span>Multi-tenant isolated & secure</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 10 }}>✓</span>
                <span>1-Click WhatsApp payment reminders</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 10 }}>✓</span>
                <span>Cloud PostgreSQL & instant sync</span>
              </div>
            </div>
          </div>
          <form className="onboarding-form" onSubmit={createWorkspace}>
            <label htmlFor="organisation-name">
              Business or workspace name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="organisation-name"
              value={organisationName}
              onChange={(e) => setOrganisationName(e.target.value)}
              placeholder="e.g. Acme Classes or Sharma Enterprises"
              required
            />

            <label htmlFor="business-type">
              Industry or Business Model <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="business-type"
              value={selectedBusinessType}
              onChange={(e) => setSelectedBusinessType(e.target.value)}
              required
            >
              <option value="">Select your business type…</option>
              {BUSINESS_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            {selectedBusinessType === "Other" && (
              <div className="onboarding-custom-field" style={{ marginTop: 4, marginBottom: 12 }}>
                <label
                  htmlFor="custom-business-type"
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontSize: 11,
                    fontWeight: 750,
                    color: "var(--ink)",
                  }}
                >
                  Describe your business <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="custom-business-type"
                  value={customBusinessType}
                  onChange={(e) => setCustomBusinessType(e.target.value)}
                  placeholder="e.g. Dance Academy, Solar Installation, Dental Clinic"
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    fontSize: 12.5,
                    background: "#ffffff",
                    color: "var(--ink)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* Smart Solution Presets Selection */}
            <fieldset className="service-selection-fieldset" style={{ marginTop: 14 }}>
              <legend style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2, color: "var(--ink)" }}>
                Choose Your Solution Package
              </legend>
              <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 6px 0" }}>
                Select the preset that matches your workflow. All pages can also be customized later in Settings.
              </p>

              <div className="preset-grid">
                {SOLUTION_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      className={`preset-card preset-card-${preset.id} ${isSelected ? "active" : ""}`}
                      onClick={() => handleSelectPreset(preset)}
                    >
                      <div>
                        <div className="preset-header">
                          <h3 className="preset-title">{preset.name}</h3>
                          <div className="preset-radio-mark" />
                        </div>

                        <div className="preset-desc-box">
                          <span className="preset-desc-label">Best for</span>
                          <p className="preset-desc">{preset.subtitle}</p>
                        </div>
                      </div>

                      <div className="preset-modules-section">
                        <span className="preset-modules-label">Included Modules</span>
                        <div className="preset-badges">
                          {preset.badges.map((badge, idx) => (
                            <span key={idx} className="preset-badge">
                              <span className="preset-badge-dot" />
                              <span>{badge}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Talk to sales team for custom setup */}
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
                  Need a custom workflow or custom modules?
                </p>
                <a
                  href="https://wa.me/919004520400?text=Hello%20CRMKaro%20Team%2C%20I%20need%20a%20custom%20workflow%20setup%20for%20my%20business."
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "#3572e8",
                    fontSize: 12.5,
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>Talk to sales team →</span>
                </a>
              </div>
            </fieldset>

            <button
              className="primary-button onboarding-submit"
              disabled={
                setupBusy ||
                organisationName.trim().length < 2 ||
                !selectedBusinessType ||
                selectedServices.length === 0
              }
              type="submit"
              style={{ marginTop: 14, background: "#4784f6", borderColor: "#4784f6" }}
            >
              {setupBusy ? "Creating workspace…" : "Complete workspace setup"}
            </button>
            {setupError ? (
              <p className="form-error" role="alert">
                {setupError}
              </p>
            ) : null}
          </form>
        </section>
      </main>
    );

  if (error)
    return (
      <main className="dashboard-state" aria-live="polite">
        <h1>Unable to load dashboard</h1>
        <p>{error}</p>
        <button
          className="primary-button"
          onClick={() => {
            setError("");
            loadDashboard().catch((reason: Error) => setError(reason.message));
          }}
          type="button"
        >
          Try again
        </button>
      </main>
    );

  if (!data) {
    return <DashboardLoading />;
  }

  const orgName = isMounted && data?.organisation?.name ? data.organisation.name : (isMounted ? cachedContext.orgName : "CRMKaro Workspace");
  const displayName = isMounted && data?.user?.name && data.user.name.trim().length > 0
    ? data.user.name
    : (isMounted ? (data?.user?.email?.split("@")[0] ?? cachedContext.userName ?? "Team Member") : "Workspace User");

  const nav: NavItem[] = isMounted && data?.services ? buildNavItems(data.services) : defaultNav;
  const todayFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell
      currentPath="/"
      nav={nav}
      organisation={orgName}
      organisations={organisations}
      product="CRMKaro"
      userName={displayName}
      userRole={data?.role?.name ?? cachedContext.userRole ?? "Owner"}
      notifications={data?.notifications}
      apiUrl={api}
      onSwitchOrganisation={handleSwitchOrg}
      onNavigate={(href) => router.push(href)}
      onPrefetch={(href) => router.prefetch(href)}
    >
      {!data ? (
        <div style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="state-spinner" />
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Loading workspace summary…</p>
        </div>
      ) : (
        <>
      {/* 🌟 Modern Hero Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          borderRadius: 16,
          padding: "24px 28px",
          color: "#ffffff",
          marginBottom: 24,
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle decorative glow */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(59, 130, 246, 0) 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  background: "rgba(59, 130, 246, 0.2)",
                  color: "#93c5fd",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 650,
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Icon name="activity" size={12} />
                {data.organisation.businessType || "Business Workspace"}
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>·</span>
              <span style={{ fontSize: 12.5, color: "#cbd5e1", fontWeight: 600 }}>{data.organisation.name}</span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.02em" }} suppressHydrationWarning>
              {getGreeting(displayName)} 👋
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "#94a3b8", maxWidth: 650 }}>
              Live pulse of your active business operations, student admissions, fee dues, and communications.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span
              suppressHydrationWarning
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#f1f5f9",
                border: "1px solid rgba(255, 255, 255, 0.12)",
              }}
            >
              📅 {todayFormatted}
            </span>
          </div>
        </div>

        {/* ⚡ Quick Routine Launch Bar */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Fast Launch:
          </span>

          <button
            onClick={() => router.push("/groups?action=new")}
            style={{
              background: "#059669",
              color: "#ffffff",
              border: "none",
              padding: "7px 14px",
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 8px rgba(5, 150, 105, 0.35)",
            }}
          >
            <Icon name="activity" size={13} />
            <span>+ New Group</span>
          </button>

          {data.services.includes("students") && (
            <>
              <button
                onClick={() => router.push("/students")}
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: 7,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.35)",
                }}
              >
                <Icon name="student" size={13} />
                <span>+ Admit Student</span>
              </button>
              <button
                onClick={() => router.push("/students")}
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  padding: "7px 14px",
                  borderRadius: 7,
                  fontSize: 12.5,
                  fontWeight: 650,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="finance" size={13} />
                <span>₹ Collect Fee / Dues</span>
              </button>
            </>
          )}

          {data.services.includes("crm") && (
            <button
              onClick={() => router.push("/crm")}
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                padding: "7px 14px",
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 650,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="crm" size={13} />
              <span>+ New Lead</span>
            </button>
          )}

          {data.services.includes("finance") && (
            <button
              onClick={() => router.push("/finance")}
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                padding: "7px 14px",
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 650,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="finance" size={13} />
              <span>+ New Invoice</span>
            </button>
          )}

          {data.services.includes("people") && (
            <button
              onClick={() => router.push("/people")}
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                padding: "7px 14px",
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 650,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="people" size={13} />
              <span>+ Add Person</span>
            </button>
          )}

          <button
            onClick={() => router.push("/settings")}
            style={{
              background: "transparent",
              color: "#94a3b8",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              padding: "7px 12px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginLeft: "auto",
            }}
          >
            <Icon name="settings" size={13} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* 📅 Date Range Filter Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "11px 18px",
          background: "#ffffff",
          borderRadius: 12,
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "#eff6ff",
              color: "#2563eb",
            }}
          >
            <Icon name="calendar" size={15} />
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 750, color: "#1e293b" }}>
            Payment & Analytics Period:
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: datePreset === "all" ? "#475569" : "#047857",
              background: datePreset === "all" ? "#f1f5f9" : "#d1fae5",
              padding: "3px 10px",
              borderRadius: 6,
            }}
          >
            {getDateBoundsForPreset(datePreset, customStartDate, customEndDate).label}
          </span>
          {dashboardLoading && (
            <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>
              Updating…
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          {/* Preset Pill Buttons */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              borderRadius: 8,
              padding: 3,
              gap: 2,
              border: "1px solid #e2e8f0",
            }}
          >
            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "this_week", label: "This Week" },
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "custom", label: "Custom Range 📅" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetChange(p.id)}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: datePreset === p.id ? 750 : 550,
                  color: datePreset === p.id ? "#0f172a" : "#64748b",
                  background: datePreset === p.id ? "#ffffff" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  boxShadow: datePreset === p.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers (Shown when custom is selected) */}
          {datePreset === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  padding: "5px 9px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid var(--line, #cbd5e1)",
                  background: "#fff",
                  color: "#1e293b",
                  fontWeight: 600,
                }}
              />
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: "5px 9px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid var(--line, #cbd5e1)",
                  background: "#fff",
                  color: "#1e293b",
                  fontWeight: 600,
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleApplyCustomDate}
                disabled={!customStartDate || !customEndDate}
                style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700 }}
              >
                Apply Range
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 📊 Live Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {data.cards.map((card, index) => {
          const targetHref =
            card.key === "total_members"
              ? "/people"
              : card.key === "total_received" || card.key === "total_due"
              ? "/transactions"
              : card.key === "active_groups"
              ? "/groups"
              : SERVICE_NAV_MAP[card.key]?.href || (card.key.startsWith("students") ? "/students" : undefined);
          return (
            <StatCard
              key={card.key}
              label={card.label}
              value={
                card.format === "money"
                  ? money(card.value, data.organisation.currency)
                  : new Intl.NumberFormat("en-IN").format(card.value)
              }
              change={card.detail}
              icon={icons[card.key] ?? "reports"}
              tone={(card.tone || ["blue", "teal", "amber", "rose", "purple"][index % 5]) as any}
              onClick={targetHref ? () => router.push(targetHref) : undefined}
            />
          );
        })}
      </div>

      {/* 📅 Today's Batches & Daily Schedule Widget */}
      {(() => {
        const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const todayDayIndex = new Date().getDay();
        const todayDayCode = DAY_CODES[todayDayIndex];
        const todayDayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
        const todaysBatches = groupsList.filter((g) => {
          if (!g.workingDays || !Array.isArray(g.workingDays) || g.workingDays.length === 0) return true;
          return g.workingDays.includes(todayDayCode);
        });

        return (
          <div className="today-batches-widget">
            <div className="today-batches-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#eef4ff",
                    color: "#3572e8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="calendar" size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Today&apos;s Batches &amp; Schedule</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: "#eef4ff",
                        color: "#3572e8",
                        border: "1px solid #c7dcfe",
                      }}
                    >
                      {todayDayName} • {todaysBatches.length} {todaysBatches.length === 1 ? "Batch" : "Batches"}
                    </span>
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                    Active classes, schedules, and rapid attendance marking for today
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => router.push("/groups?action=new")}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12, padding: "5px 11px", fontWeight: 700 }}
                >
                  <Icon name="plus" size={13} />
                  <span>New Batch</span>
                </button>
                <button
                  onClick={() => router.push("/groups")}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12, padding: "5px 11px", color: "#3572e8" }}
                >
                  <span>View All Groups →</span>
                </button>
              </div>
            </div>

            {todaysBatches.length === 0 ? (
              <div
                style={{
                  padding: "24px 20px",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: "1px dashed var(--line)",
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                  No batches scheduled for {todayDayName}.
                </p>
                <button
                  onClick={() => router.push("/groups?action=new")}
                  className="primary-button"
                  style={{ margin: "10px auto 0", fontSize: 12, padding: "6px 14px" }}
                >
                  <span>+ Create First Batch</span>
                </button>
              </div>
            ) : (
              <div className="today-batches-grid">
                {todaysBatches.map((batch) => {
                  const monogram = batch.code || batch.name.substring(0, 2).toUpperCase();
                  const memberCount = batch._count?.members ?? batch.membersCount ?? 0;
                  const dueFormatted = ((batch.feeAmountMinor || 0) / 100).toLocaleString("en-IN");

                  return (
                    <div key={batch.id} className="today-batch-card">
                      <div className="today-batch-hero">
                        <div className="today-batch-monogram" style={{ background: batch.color || "#e0f2fe" }}>
                          {monogram}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <strong style={{ fontSize: 14, color: "var(--ink)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {batch.name}
                          </strong>
                          <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => {
                              const isToday = d === todayDayCode;
                              const isWorking = batch.workingDays?.includes(d);
                              return (
                                <span
                                  key={d}
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: "50%",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 9,
                                    fontWeight: 800,
                                    background: isToday ? "#7fabfd" : isWorking ? "#f1f5f9" : "transparent",
                                    color: isToday ? "#ffffff" : isWorking ? "#334155" : "#cbd5e1",
                                    border: isToday ? "1px solid #548ef7" : "none",
                                  }}
                                >
                                  {d[0]}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="today-batch-meta">
                        <span><strong>{memberCount}</strong> Members</span>
                        <span>Fee: <strong>₹{dueFormatted}</strong></span>
                      </div>

                      <div className="today-batch-actions">
                        <button
                          onClick={() => router.push(`/groups`)}
                          className="primary-button"
                          style={{ flex: 1, justifyContent: "center", padding: "6px 10px", fontSize: 12 }}
                        >
                          <Icon name="check" size={13} />
                          <span>Mark Attendance</span>
                        </button>
                        <button
                          onClick={() => router.push("/quick-collect")}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "6px 10px", fontSize: 12 }}
                          title="Collect Fee"
                        >
                          <Icon name="zap" size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* 2-Column Content Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 24, alignItems: "start" }}>
        {/* Left Column: Alerts & Recent Transactions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 🚨 Priority Action Hub */}
          <SectionCard
            title="Operational Focus & Action Items"
            subtitle="Prioritized signals that need your team's attention"
          >
            {data.notifications.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.notifications.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      border:
                        item.severity === "critical"
                          ? "1px solid #fecaca"
                          : item.severity === "warning"
                            ? "1px solid #fef3c7"
                            : "1px solid #e0f2fe",
                      background:
                        item.severity === "critical"
                          ? "#fef2f2"
                          : item.severity === "warning"
                            ? "#fffbeb"
                            : "#f0f9ff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background:
                            item.severity === "critical"
                              ? "#fee2e2"
                              : item.severity === "warning"
                                ? "#fef3c7"
                                : "#e0f2fe",
                          color:
                            item.severity === "critical"
                              ? "#ef4444"
                              : item.severity === "warning"
                                ? "#d97706"
                                : "#0284c7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon name={icons[item.module] ?? "bell"} size={16} />
                      </div>
                      <div>
                        <strong
                          style={{
                            fontSize: 13.5,
                            color:
                              item.severity === "critical"
                                ? "#991b1b"
                                : item.severity === "warning"
                                  ? "#92400e"
                                  : "#075985",
                            display: "block",
                          }}
                        >
                          {item.title}
                        </strong>
                        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#475569" }}>
                          {item.detail}
                        </p>
                      </div>
                    </div>

                    {item.actionHref && (
                      <button
                        onClick={() => router.push(item.actionHref!)}
                        className="primary-button"
                        style={{
                          padding: "6px 14px",
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 7,
                          background:
                            item.severity === "critical"
                              ? "#dc2626"
                              : item.severity === "warning"
                                ? "#d97706"
                                : "#0284c7",
                          borderColor: "transparent",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span>{item.actionLabel || "Resolve"} →</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "24px 20px",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: "1px dashed #cbd5e1",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "#dcfce7",
                    color: "#16a34a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 10px",
                    fontSize: 20,
                  }}
                >
                  ✓
                </div>
                <strong style={{ fontSize: 14, color: "var(--ink)", display: "block" }}>
                  All Caught Up!
                </strong>
                <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 0" }}>
                  No overdue invoices, pending follow-ups, or unrecorded critical actions.
                </p>
              </div>
            )}
          </SectionCard>

          {/* 💵 Recent Transactions & Collections */}
          <SectionCard
            title="Recent Collections & Payment Ledger"
            subtitle="Latest receipts generated across your workspace"
          >
            {data.transactions && data.transactions.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px", fontWeight: 650 }}>Receipt #</th>
                      <th style={{ padding: "8px 10px", fontWeight: 650 }}>Payer / Student</th>
                      <th style={{ padding: "8px 10px", fontWeight: 650 }}>Mode</th>
                      <th style={{ padding: "8px 10px", fontWeight: 650, textAlign: "right" }}>Amount Paid</th>
                      <th style={{ padding: "8px 10px", fontWeight: 650, textAlign: "right" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        style={{ borderBottom: "1px solid #f1f5f9" }}
                      >
                        <td style={{ padding: "10px", fontWeight: 700, color: "var(--ink)" }}>
                          {tx.receiptNumber}
                        </td>
                        <td style={{ padding: "10px", color: "var(--ink)", fontWeight: 600 }}>
                          {tx.personName}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <Badge tone="neutral">{tx.method}</Badge>
                        </td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: 750, color: "#16a34a" }}>
                          +{money(tx.amountMinor, data.organisation.currency)}
                        </td>
                        <td style={{ padding: "10px", textAlign: "right", color: "var(--muted)", fontSize: 12 }}>
                          {formatRelativeTime(tx.receivedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                No recent fee receipts or collections recorded yet.
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right Column: Active Modules & Activity Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 🚀 Active Modules Launch Hub */}
          <SectionCard
            title="Active Modules & Services"
            subtitle={`${data.services.length} active modules enabled for ${data.organisation.name}`}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {data.services.map((service) => {
                const navItem = SERVICE_NAV_MAP[service];
                if (!navItem || !navItem.href) return null;
                const href = navItem.href;
                return (
                  <div
                    key={service}
                    onClick={() => router.push(href)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: 9,
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--brand)";
                      e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.background = "#ffffff";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 7,
                          background: "#eff6ff",
                          color: "var(--brand)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon name={icons[service] ?? "services"} size={16} />
                      </div>
                      <div>
                        <strong style={{ fontSize: 13, color: "var(--ink)", display: "block" }}>
                          {navItem.label}
                        </strong>
                        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Click to launch</span>
                      </div>
                    </div>

                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand)" }}>
                      Open →
                    </span>
                  </div>
                );
              })}

              <div
                onClick={() => router.push("/settings")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px dashed #cbd5e1",
                  background: "#f8fafc",
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 650,
                  color: "var(--muted)",
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                + Add or Discontinue Services in Settings
              </div>
            </div>
          </SectionCard>

          {/* 🕒 Live Activity Stream */}
          <SectionCard
            title="Live Workspace Activity"
            subtitle="Real-time operational audit timeline"
          >
            <ul className="activity-list" style={{ margin: 0, padding: 0 }}>
              {data.activity.length ? (
                data.activity.map((item) => (
                  <li key={item.id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span className="activity-dot" style={{ background: "#eff6ff", color: "var(--brand)" }}>
                      <Icon name={icons[item.entityType] ?? "activity"} size={14} />
                    </span>
                    <span className="activity-copy">
                      <strong style={{ fontSize: 13, color: "var(--ink)" }}>
                        {humanizeAction(item.action)}
                      </strong>
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                        {item.entityType.replace(/_/g, " ")}
                      </span>
                    </span>
                    <time style={{ fontSize: 11.5, color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {formatRelativeTime(item.createdAt)}
                    </time>
                  </li>
                ))
              ) : (
                <li className="empty-row" style={{ padding: "14px 0" }}>
                  <span className="activity-copy">
                    <strong>No recent activity</strong>
                    <span>New workspace events will stream here in real time.</span>
                  </span>
                </li>
              )}
            </ul>
          </SectionCard>
        </div>
      </div>
        </>
      )}
    </AppShell>
  );
}
