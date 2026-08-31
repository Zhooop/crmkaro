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
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
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

function DashboardLoading() {
  return (
    <main className="dashboard-state" aria-live="polite">
      <div className="state-spinner" />
      <h1>Loading your workspace…</h1>
      <p>Fetching the latest business overview.</p>
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
] as const;

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);
  const [error, setError] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [organisationName, setOrganisationName] = useState("");
  const [selectedBusinessType, setSelectedBusinessType] = useState("");
  const [customBusinessType, setCustomBusinessType] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState("");

  const api = getApiUrl();

  const loadDashboard = useCallback(async () => {
    const response = await authFetch(`${api}/dashboard`);
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
      const retry = await authFetch(`${api}/dashboard`);
      if (!retry.ok) throw new Error("Could not load your workspace summary.");
      const retryData = (await retry.json()) as Dashboard;
      setData(retryData);
      saveActiveServicesToStorage(retryData.services || []);
      return;
    }

    if (!response.ok)
      throw new Error(
        "Could not load your workspace overview. Please try again.",
      );
    const dashboardData = (await response.json()) as Dashboard;
    setData(dashboardData);
    saveActiveServicesToStorage(dashboardData.services || []);

    const orgsRes = await authFetch(`${api}/organisations`);
    if (orgsRes.ok) {
      const orgList = await orgsRes.json();
      setOrganisations(
        orgList
          .map((o: { organisation: { id: string; name: string; businessType?: string } }) => o.organisation)
          .filter(Boolean),
      );
    }
  }, [api, router]);

  useEffect(() => {
    loadDashboard().catch((reason: Error) => setError(reason.message));
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
            <span className="onboarding-mark" aria-hidden="true" />
            <p className="eyebrow">First workspace</p>
            <h1>Let’s set up your business.</h1>
            <p>
              Create a private workspace. Select the services and modules you need now (you can add or archive anytime in Settings).
            </p>
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
              <div style={{ marginTop: 10 }}>
                <label htmlFor="custom-business-type">Describe your business</label>
                <input
                  id="custom-business-type"
                  value={customBusinessType}
                  onChange={(e) => setCustomBusinessType(e.target.value)}
                  placeholder="e.g. Dance Academy, Solar Installation, Dental Clinic"
                  required
                />
              </div>
            )}

            <fieldset className="service-selection-fieldset" style={{ marginTop: 22 }}>
              <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>
                Select initial modules to activate
              </legend>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px 0" }}>
                Select only what you need. (All services are deselected by default. You can enable or archive modules anytime in Settings).
              </p>
              <div className="service-checkbox-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {ALL_AVAILABLE_SERVICES.map((srv) => {
                  const isChecked = selectedServices.includes(srv.code);
                  return (
                    <label
                      key={srv.code}
                      className={`service-checkbox-card ${isChecked ? "active" : ""}`}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "12px 14px",
                        border: isChecked ? "1.5px solid var(--brand)" : "1px solid #e2e8f0",
                        borderRadius: 9,
                        background: isChecked ? "rgba(37, 99, 235, 0.04)" : "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedServices([...selectedServices, srv.code]);
                          } else {
                            setSelectedServices(selectedServices.filter((c) => c !== srv.code));
                          }
                        }}
                        style={{ marginTop: 3 }}
                      />
                      <div>
                        <strong style={{ fontSize: 13, color: "var(--ink)", display: "block" }}>{srv.name}</strong>
                        <span style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginTop: 2 }}>
                          {srv.detail}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <button
              className="primary-button onboarding-submit"
              disabled={
                setupBusy ||
                organisationName.trim().length < 2 ||
                !selectedBusinessType
              }
              type="submit"
              style={{ marginTop: 20 }}
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

  if (!data) return <DashboardLoading />;

  const displayName =
    data.user?.name && data.user.name.trim().length > 0
      ? data.user.name
      : (data.user?.email.split("@")[0] ?? "Team Member");

  const nav: NavItem[] = buildNavItems(data.services || []);
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
      organisation={data.organisation.name}
      organisations={organisations}
      product="CRMKaro"
      userName={displayName}
      userRole={data.role?.name ?? "Owner"}
      notifications={data.notifications}
      apiUrl={api}
      onSwitchOrganisation={handleSwitchOrg}
      onNavigate={(href) => router.push(href)}
    >
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

            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
              {getGreeting(displayName)} 👋
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "#94a3b8", maxWidth: 650 }}>
              Live pulse of your active business operations, student admissions, fee dues, and communications.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span
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

      {/* 📊 Live Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {data.cards.map((card, index) => {
          const targetHref = SERVICE_NAV_MAP[card.key]?.href || (card.key.startsWith("students") ? "/students" : undefined);
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
    </AppShell>
  );
}
