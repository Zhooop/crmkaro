"use client";

export const dynamic = "force-dynamic";

import {
  AppShell,
  Badge,
  Icon,
  Modal,
  SectionCard,
  StatCard,
  type NavItem,
} from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import { UsersView } from "./components/users-view";
import { CmsView } from "./components/cms-view";
import { TransactionsView } from "./components/transactions-view";
import { NotificationsView } from "./components/notifications-view";
import { ReportsView } from "./components/reports-view";
import { TeamView } from "./components/team-view";
import { PlansView } from "./components/plans-view";

const nav: NavItem[] = [
  { label: "Platform Overview", icon: "home", href: "#overview" },
  { label: "Subscription Plans", icon: "rupee", href: "#plans" },
  { label: "User Directory", icon: "people", href: "#users" },
  { label: "CMS & Banners", icon: "services", href: "#cms" },
  { label: "Payments & Refunds", icon: "finance", href: "#transactions" },
  { label: "Broadcasts", icon: "bell", href: "#notifications" },
  { label: "Business Reports", icon: "reports", href: "#reports" },
  { label: "Team & Permissions", icon: "shield", href: "#team" },
  { label: "Organisations & Tenants", icon: "building", href: "#organisations" },
  { label: "Services & Adoption", icon: "settings", href: "#services" },
  { label: "Platform Audit", icon: "shield", href: "#audit" },
  { label: "System Health", icon: "activity", href: "#health" },
];

type PlatformOverview = {
  stats: {
    organisations: number;
    activeOrganisations: number;
    totalUsers: number;
    activeServices: number;
  };
  recentOrganisations: Array<{
    id: string;
    name: string;
    slug: string;
    businessType: string;
    currency: string;
    status: string;
    memberCount: number;
    services: string[];
    createdAt: string;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    actorName: string;
    organisationName: string;
    createdAt: string;
  }>;
  adoption: Array<{
    code: string;
    name: string;
    count: number;
    percentage: number;
  }>;
};

type OrganisationDetail = {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  status: string;
  currency: string;
  timezone: string;
  memberCount: number;
  peopleCount: number;
  invoicesCount: number;
  leadsCount: number;
  services: Array<{ code: string; name: string }>;
  createdAt: string;
};

type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  organisation: string;
  createdAt: string;
};

type HealthData = {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: string;
    counts: {
      users: number;
      organisations: number;
      people: number;
      invoices: number;
      leads: number;
      auditLogs: number;
    };
  };
  system: {
    nodeVersion: string;
    platform: string;
    rssMemoryMb: number;
    heapUsedMb: number;
  };
};

const ALL_AVAILABLE_SERVICES = [
  { code: "people", name: "People & HR Directory", desc: "Employee profiles, departments, hierarchy, and attendance" },
  { code: "crm", name: "Sales CRM & Pipelines", desc: "Lead stages, deal pipelines, activities, and customer tracking" },
  { code: "finance", name: "Invoicing & GST Finance", desc: "GST invoices, payments reconciliation, expense tracking" },
  { code: "payroll", name: "Payroll & Salary Slips", desc: "Automated monthly payroll runs and employee salary distribution" },
  { code: "inventory", name: "Stock & Inventory", desc: "SKU catalog, stock movements, and low inventory tracking" },
];

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

export default function AdminHomePage() {
  const router = useRouter();
  const api = getApiUrl();

  // Navigation tab state
  type PlatformTab =
    | "overview"
    | "plans"
    | "users"
    | "cms"
    | "transactions"
    | "notifications"
    | "reports"
    | "team"
    | "organisations"
    | "services"
    | "audit"
    | "health";

  const [activeTab, setActiveTab] = useState<PlatformTab>("overview");

  // Data states
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationDetail[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const triggerFeedback = useCallback((message: string, type: "success" | "error") => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  }, []);

  // Search & Filter states
  const [orgSearch, setOrgSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [auditSearch, setAuditSearch] = useState("");

  // Modals state
  const [selectedOrg, setSelectedOrg] = useState<OrganisationDetail | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Delete Org state
  const [orgToDelete, setOrgToDelete] = useState<OrganisationDetail | null>(null);
  const [deleteOwnerUser, setDeleteOwnerUser] = useState(true);
  const [confirmOrgNameInput, setConfirmOrgNameInput] = useState("");
  const [deletingOrg, setDeletingOrg] = useState(false);

  // Service toggle state inside detail modal
  const [editableServices, setEditableServices] = useState<string[]>([]);

  // Create Org Form State
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgBusinessType, setNewOrgBusinessType] = useState<string>("Beauty, Salon & Spa");
  const [newOrgCustomBusinessType, setNewOrgCustomBusinessType] = useState<string>("");
  const [newOrgCurrency, setNewOrgCurrency] = useState("INR");
  const [newOrgOwnerEmail, setNewOrgOwnerEmail] = useState("");
  const [newOrgServices, setNewOrgServices] = useState<string[]>(["crm", "finance", "people", "payroll", "inventory"]);

  // Listen to hash changes for direct tab linking
  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash.replace("#", "");
      const validTabs = [
        "overview",
        "plans",
        "users",
        "cms",
        "transactions",
        "notifications",
        "reports",
        "team",
        "organisations",
        "services",
        "audit",
        "health",
      ];
      if (validTabs.includes(hash)) {
        setActiveTab(hash as any);
      }
    }
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Overview data
      const res = await authFetch(`${api}/platform/overview`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load platform overview.");
      const overviewData = await res.json();
      setData(overviewData);

      // 2. All organisations
      const orgsRes = await authFetch(`${api}/platform/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        setOrganisations(orgsData.organisations || []);
      }

      // 3. Full Audit logs
      const auditRes = await authFetch(`${api}/platform/audit?limit=100`, { credentials: "include" });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs || []);
      }

      // 4. System Health
      const healthRes = await authFetch(`${api}/platform/health`, { credentials: "include" });
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealth(healthData);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, router]);

  async function handleAdminLogout() {
    try {
      await authFetch(`${api}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    router.replace("/login");
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When an org is selected, initialize its editable services
  function handleSelectOrg(org: OrganisationDetail) {
    setSelectedOrg(org);
    setEditableServices(org.services.map((s) => s.code));
  }

  // Toggle Organisation Status (ACTIVE <-> SUSPENDED)
  async function handleToggleOrgStatus(org: OrganisationDetail) {
    const nextStatus = org.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setSavingOrg(true);
    try {
      const res = await authFetch(`${api}/platform/organisations/${org.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status.");
      
      const updated = { ...org, status: nextStatus };
      setSelectedOrg(updated);
      setOrganisations((prev) => prev.map((o) => (o.id === org.id ? updated : o)));
      setFeedback({ message: `Organisation marked as ${nextStatus}`, type: "success" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ message: (err as Error).message, type: "error" });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setSavingOrg(false);
    }
  }

  // Save Service Entitlements for an organisation
  async function handleSaveServices(org: OrganisationDetail) {
    setSavingOrg(true);
    try {
      const res = await authFetch(`${api}/platform/organisations/${org.id}/services`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceCodes: editableServices }),
      });
      if (!res.ok) throw new Error("Failed to save service entitlements.");

      const updatedServices = ALL_AVAILABLE_SERVICES.filter((s) => editableServices.includes(s.code)).map((s) => ({
        code: s.code,
        name: s.name,
      }));

      const updated = { ...org, services: updatedServices };
      setSelectedOrg(updated);
      setOrganisations((prev) => prev.map((o) => (o.id === org.id ? updated : o)));
      setFeedback({ message: "Service entitlements updated successfully!", type: "success" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ message: (err as Error).message, type: "error" });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setSavingOrg(false);
    }
  }

  // Delete Workspace Permanently
  async function handleExecuteDeleteOrg() {
    if (!orgToDelete) return;
    setDeletingOrg(true);
    try {
      const res = await authFetch(
        `${api}/platform/organisations/${orgToDelete.id}?deleteOwnerUser=${deleteOwnerUser ? "true" : "false"}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to delete organisation");
      }
      triggerFeedback(
        `Workspace "${orgToDelete.name}" ${deleteOwnerUser ? "and owner account " : ""}deleted permanently!`,
        "success"
      );
      setOrgToDelete(null);
      setSelectedOrg(null);
      loadData();
    } catch (err) {
      triggerFeedback((err as Error).message, "error");
    } finally {
      setDeletingOrg(false);
    }
  }

  // Create New Tenant
  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    const effectiveBusinessType =
      newOrgBusinessType === "Other"
        ? newOrgCustomBusinessType.trim()
        : newOrgBusinessType;

    if (!effectiveBusinessType) {
      setFeedback({ message: "Business type is required.", type: "error" });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setSavingOrg(true);
    try {
      const res = await authFetch(`${api}/platform/organisations`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newOrgName.trim(),
          businessType: effectiveBusinessType,
          currency: newOrgCurrency,
          ownerEmail: newOrgOwnerEmail.trim() || undefined,
          serviceCodes: newOrgServices,
        }),
      });
      if (!res.ok) throw new Error("Failed to create organisation.");
      const data = await res.json();
      
      setCreateModalOpen(false);
      setNewOrgName("");
      setNewOrgCustomBusinessType("");
      setNewOrgOwnerEmail("");
      setFeedback({ message: `Tenant "${data.organisation.name}" onboarded successfully!`, type: "success" });
      setTimeout(() => setFeedback(null), 3000);
      loadData();
    } catch (err) {
      setFeedback({ message: (err as Error).message, type: "error" });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setSavingOrg(false);
    }
  }

  // Copy Tenant ID
  function copyTenantId(id: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }

  // Filtered Organisations
  const filteredOrgs = organisations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
      org.slug.toLowerCase().includes(orgSearch.toLowerCase()) ||
      org.businessType.toLowerCase().includes(orgSearch.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Audit Logs
  const filteredAudit = auditLogs.filter((log) => {
    return (
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.actor.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.organisation.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.entityType.toLowerCase().includes(auditSearch.toLowerCase())
    );
  });

  return (
    <AppShell
      product="CRMKaro Admin"
      organisation="Platform Operations"
      nav={nav}
      currentPath={`#${activeTab}`}
      userName="Super Admin"
      userRole="Platform Administrator"
      onNavigate={(href) => {
        if (href.startsWith("#")) {
          setActiveTab(href.slice(1) as any);
        } else {
          router.push(href);
        }
      }}
    >
      {/* Toast Feedback */}
      {feedback && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: "10px 18px",
            borderRadius: 8,
            background: feedback.type === "success" ? "#065f46" : "#991b1b",
            color: "#ffffff",
            border: `1px solid ${feedback.type === "success" ? "#059669" : "#dc2626"}`,
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          <Icon name={feedback.type === "success" ? "checkCircle" : "alertCircle"} size={15} />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="shield" size={13} /> Restricted Platform Console
          </p>
          <h1>Platform Operations Console</h1>
          <p className="subheading">
            Live multi-tenant telemetry, tenant provisioning, service entitlements, and append-only audit.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="secondary-btn"
            onClick={loadData}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, fontSize: 12 }}
          >
            <Icon name="activity" size={13} />
            <span>Refresh Telemetry</span>
          </button>
          <button
            className="primary-btn"
            onClick={() => setCreateModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, fontSize: 12 }}
          >
            <Icon name="plus" size={14} />
            <span>+ Onboard Tenant</span>
          </button>
          <button
            className="secondary-btn"
            onClick={handleAdminLogout}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              color: "#dc2626",
              border: "1px solid #fecaca",
              background: "#fef2f2",
              cursor: "pointer",
              fontSize: 12,
            }}
            title="Sign out of platform admin console"
          >
            <Icon name="logout" size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-nav-tabs" style={{ display: "flex", gap: 6, borderBottom: "1px solid #e2e8f0", paddingBottom: 10, marginBottom: 20, overflowX: "auto" }}>
        {[
          { key: "overview", label: "Platform Overview", icon: "home" },
          { key: "plans", label: "Subscription Plans", icon: "rupee" },
          { key: "users", label: "User Directory", icon: "people" },
          { key: "cms", label: "CMS & Banners", icon: "services" },
          { key: "transactions", label: "Payments & Refunds", icon: "finance" },
          { key: "notifications", label: "Broadcasts", icon: "bell" },
          { key: "reports", label: "Business Reports", icon: "reports" },
          { key: "team", label: "Team & Permissions", icon: "shield" },
          { key: "organisations", label: `Tenants (${organisations.length})`, icon: "building" },
          { key: "services", label: "Services & Adoption", icon: "settings" },
          { key: "audit", label: `Audit Trail (${auditLogs.length})`, icon: "shield" },
          { key: "health", label: "System Health", icon: "activity" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                window.location.hash = tab.key;
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: isActive ? "1px solid #bae6fd" : "1px solid #e2e8f0",
                background: isActive ? "#e0f2fe" : "#ffffff",
                color: isActive ? "#0284c7" : "#475569",
                fontWeight: isActive ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <Icon name={tab.icon as any} size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="state-spinner" />
          <p style={{ color: "#94a3b8" }}>Aggregating live multi-tenant platform metrics…</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <Icon name="alertCircle" size={28} />
          <h3>Platform Console Telemetry Error</h3>
          <p>{error}</p>
          <button className="primary-btn" onClick={loadData} style={{ marginTop: 12 }}>
            Retry Connection
          </button>
        </div>
      ) : (
        <>
          {/* TAB 1: PLATFORM OVERVIEW */}
          {activeTab === "overview" && (
            <>
              <div className="stats-grid">
                <StatCard
                  label="Registered Tenants"
                  value={data?.stats.organisations ?? 0}
                  change={`${data?.stats.activeOrganisations ?? 0} active workspaces`}
                  icon="building"
                  tone="blue"
                  onClick={() => setActiveTab("organisations")}
                />
                <StatCard
                  label="Active Services"
                  value={data?.stats.activeServices ?? 0}
                  change="Tenant entitlements"
                  icon="services"
                  tone="teal"
                  onClick={() => setActiveTab("services")}
                />
                <StatCard
                  label="Platform Users"
                  value={data?.stats.totalUsers ?? 0}
                  change="Verified accounts"
                  icon="people"
                  tone="amber"
                />
                <StatCard
                  label="Security Posture"
                  value={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span className="live-pulse-dot" />
                      <span>RLS Isolated</span>
                    </span>
                  }
                  change="PostgreSQL Kernel Enforced"
                  icon="shield"
                  tone="purple"
                  onClick={() => setActiveTab("health")}
                />
              </div>

              <div className="content-grid" style={{ marginTop: 24 }}>
                {/* Recent Organisations */}
                <SectionCard
                  title="Registered Workspaces"
                  subtitle="Latest client organisations onboarding"
                  action="View All Tenants"
                  onAction={() => setActiveTab("organisations")}
                >
                  <ul className="activity-list">
                    {data?.recentOrganisations.map((org) => (
                      <li
                        key={org.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          const full = organisations.find((o) => o.id === org.id);
                          if (full) handleSelectOrg(full);
                        }}
                      >
                        <span className="activity-dot">
                          <Icon name="building" />
                        </span>
                        <span className="activity-copy">
                          <strong>{org.name}</strong>
                          <span>
                            {org.businessType} · {org.services.join(", ") || "Core workspace"}
                          </span>
                        </span>
                        <Badge tone={org.status === "ACTIVE" ? "green" : "neutral"}>
                          {org.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                {/* Service Adoption Breakdown */}
                <SectionCard
                  title="Service Adoption Matrix"
                  subtitle="Active modules across registered workspaces"
                  action="Inspect Services"
                  onAction={() => setActiveTab("services")}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {data?.adoption.map((s) => (
                      <div key={s.code} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                          <strong style={{ color: "#0f172a" }}>{s.name}</strong>
                          <span style={{ color: "#0284c7", fontWeight: 700 }}>
                            {s.count} tenants ({s.percentage}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: "#f1f5f9",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.max(s.percentage, 8)}%`,
                              background: "#0284c7",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* Platform Audit Trail */}
                <SectionCard
                  title="Live Platform Audit"
                  subtitle="Latest security & operational events"
                  action="View Full Audit Log"
                  onAction={() => setActiveTab("audit")}
                >
                  <ul className="activity-list">
                    {data?.recentAudit.map((audit) => (
                      <li key={audit.id}>
                        <span className="activity-dot">
                          <Icon name="shield" />
                        </span>
                        <span className="activity-copy">
                          <strong>{audit.action}</strong>
                          <span>
                            {audit.organisationName} · Actor: {audit.actorName}
                          </span>
                        </span>
                        <time>{new Date(audit.createdAt).toLocaleTimeString()}</time>
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                {/* Administrative Operations */}
                <SectionCard
                  title="Administrative Tools"
                  subtitle="Direct platform operations workflows"
                >
                  <div className="quick-grid">
                    <button className="quick-tile" onClick={() => setCreateModalOpen(true)}>
                      <Icon name="plus" />
                      <div>
                        <strong>Onboard Tenant</strong>
                        <small>Provision workspace</small>
                      </div>
                    </button>
                    <button className="quick-tile" onClick={() => setActiveTab("organisations")}>
                      <Icon name="building" />
                      <div>
                        <strong>Tenant Directory</strong>
                        <small>Manage all {organisations.length} tenants</small>
                      </div>
                    </button>
                    <button className="quick-tile" onClick={() => setActiveTab("health")}>
                      <Icon name="activity" />
                      <div>
                        <strong>System Health</strong>
                        <small>DB tables & Node telemetry</small>
                      </div>
                    </button>
                  </div>
                </SectionCard>
              </div>
            </>
          )}

          {/* TAB: SUBSCRIPTION PLANS */}
          {activeTab === "plans" && (
            <PlansView onFeedback={triggerFeedback} />
          )}

          {/* TAB: USERS DIRECTORY */}
          {activeTab === "users" && (
            <UsersView onFeedback={triggerFeedback} />
          )}

          {/* TAB: CMS & BANNERS */}
          {activeTab === "cms" && (
            <CmsView onFeedback={triggerFeedback} />
          )}

          {/* TAB: PAYMENTS & TRANSACTIONS */}
          {activeTab === "transactions" && (
            <TransactionsView onFeedback={triggerFeedback} />
          )}

          {/* TAB: BROADCAST NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <NotificationsView onFeedback={triggerFeedback} />
          )}

          {/* TAB: BUSINESS REPORTS */}
          {activeTab === "reports" && (
            <ReportsView onFeedback={triggerFeedback} />
          )}

          {/* TAB: TEAM & PERMISSIONS */}
          {activeTab === "team" && (
            <TeamView onFeedback={triggerFeedback} />
          )}

          {/* TAB 2: ORGANISATIONS & TENANTS */}
          {activeTab === "organisations" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Search & Filter Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                  flexWrap: "wrap",
                  padding: "12px 16px",
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
                  <Icon name="search" size={15} />
                  <input
                    type="text"
                    placeholder="Search tenants by name, slug, or type…"
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      color: "#0f172a",
                      fontSize: 12.5,
                      outline: "none",
                    }}
                  />
                  {orgSearch && (
                    <button
                      onClick={() => setOrgSearch("")}
                      style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      color: "#0f172a",
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="SUSPENDED">Suspended Only</option>
                  </select>

                  <button
                    className="primary-btn"
                    onClick={() => setCreateModalOpen(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 6, fontSize: 12 }}
                  >
                    <Icon name="plus" size={13} />
                    <span>Onboard Tenant</span>
                  </button>
                </div>
              </div>

              {/* Tenants Table */}
              <div className="section-card" style={{ padding: 0 }}>
                <header style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0" }}>
                  <div>
                    <h2 style={{ color: "#0f172a", margin: 0, fontSize: 14 }}>
                      Registered Workspaces ({filteredOrgs.length})
                    </h2>
                    <p style={{ color: "#64748b", margin: "2px 0 0", fontSize: 11.5 }}>
                      Click any row to manage tenant settings, toggle status, or configure service entitlements.
                    </p>
                  </div>
                </header>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Organisation Name</th>
                        <th>Type & Currency</th>
                        <th>Status</th>
                        <th>Members</th>
                        <th>Directory</th>
                        <th>Entitled Services</th>
                        <th>Created Date</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrgs.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "28px 16px", color: "#64748b", fontSize: 12 }}>
                            No tenants match your search filter.
                          </td>
                        </tr>
                      ) : (
                        filteredOrgs.map((org) => (
                          <tr
                            key={org.id}
                            className="clickable"
                            onClick={() => handleSelectOrg(org)}
                          >
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 6,
                                    background: "linear-gradient(135deg, #0284c7, #38bdf8)",
                                    color: "#ffffff",
                                    display: "grid",
                                    placeItems: "center",
                                    fontWeight: 700,
                                    fontSize: 12,
                                  }}
                                >
                                  {org.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <strong style={{ color: "#0f172a", display: "block", fontSize: 12.5 }}>{org.name}</strong>
                                  <small style={{ color: "#64748b", fontSize: 11 }}>{org.slug}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ color: "#334155", display: "block", fontSize: 12 }}>{org.businessType}</span>
                              <small style={{ color: "#64748b", fontSize: 11 }}>{org.currency} ({org.timezone})</small>
                            </td>
                            <td>
                              <Badge tone={org.status === "ACTIVE" ? "green" : "neutral"}>
                                {org.status}
                              </Badge>
                            </td>
                            <td>
                              <span style={{ color: "#0f172a", fontWeight: 600, fontSize: 12 }}>{org.memberCount}</span>
                              <small style={{ color: "#64748b", display: "block", fontSize: 11 }}>users</small>
                            </td>
                            <td>
                              <span style={{ color: "#334155", fontSize: 12 }}>{org.peopleCount} contacts</span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 220 }}>
                                {org.services.map((s) => (
                                  <span
                                    key={s.code}
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: "#f0f9ff",
                                      color: "#0284c7",
                                      border: "1px solid #bae6fd",
                                    }}
                                  >
                                    {s.code.toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                                {new Date(org.createdAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <button
                                  className="secondary-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectOrg(org);
                                  }}
                                  style={{ padding: "4px 10px", fontSize: 12 }}
                                >
                                  Manage
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOrgToDelete(org);
                                    setDeleteOwnerUser(true);
                                    setConfirmOrgNameInput("");
                                  }}
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: 11.5,
                                    borderRadius: 6,
                                    border: "1px solid #fecaca",
                                    background: "#fef2f2",
                                    color: "#dc2626",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                  title="Delete workspace permanently"
                                >
                                  <Icon name="trash" size={12} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SERVICES & ADOPTION */}
          {activeTab === "services" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="section-card" style={{ padding: 18 }}>
                <h2 style={{ color: "#0f172a", margin: "0 0 4px", fontSize: 14.5 }}>Platform Service Modules & Entitlements</h2>
                <p style={{ color: "#64748b", margin: 0, fontSize: 12 }}>
                  CRMKaro modular architecture lets you provision and enable specific capabilities per organisation tenant.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                {ALL_AVAILABLE_SERVICES.map((s) => {
                  const adoption = data?.adoption.find((a) => a.code === s.code);
                  const count = adoption?.count || 0;
                  const percentage = adoption?.percentage || 0;

                  return (
                    <div
                      key={s.code}
                      className="section-card"
                      style={{
                        padding: 18,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: "#e0f2fe",
                              color: "#0284c7",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <Icon name={s.code === "people" ? "people" : s.code === "crm" ? "activity" : s.code === "finance" ? "rupee" : s.code === "payroll" ? "calendar" : "tag"} size={17} />
                          </div>
                          <div>
                            <strong style={{ color: "#0f172a", fontSize: 13.5, display: "block" }}>{s.name}</strong>
                            <code style={{ color: "#0284c7", fontSize: 11 }}>module: {s.code}</code>
                          </div>
                        </div>
                        <Badge tone="green">Active</Badge>
                      </div>

                      <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.45 }}>
                        {s.desc}
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: "auto", paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                          <span style={{ color: "#64748b" }}>Adoption Rate:</span>
                          <strong style={{ color: "#0f172a" }}>{count} tenants ({percentage}%)</strong>
                        </div>
                        <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.max(percentage, 5)}%`, background: "#0284c7" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: PLATFORM AUDIT */}
          {activeTab === "audit" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 16px",
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <Icon name="search" size={15} />
                  <input
                    type="text"
                    placeholder="Search audit logs by action, actor, or organisation…"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      color: "#0f172a",
                      fontSize: 12.5,
                      outline: "none",
                    }}
                  />
                  {auditSearch && (
                    <button
                      onClick={() => setAuditSearch("")}
                      style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="section-card" style={{ padding: 0 }}>
                <header style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0" }}>
                  <div>
                    <h2 style={{ color: "#0f172a", margin: 0, fontSize: 14 }}>
                      Global Platform Audit Trail ({filteredAudit.length} events)
                    </h2>
                    <p style={{ color: "#64748b", margin: "2px 0 0", fontSize: 11.5 }}>
                      Append-only cryptographically verifiable operations ledger.
                    </p>
                  </div>
                </header>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Target Entity</th>
                        <th>Actor</th>
                        <th>Organisation Scope</th>
                        <th>Timestamp (UTC/IST)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAudit.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: "28px 16px", color: "#64748b", fontSize: 12 }}>
                            No audit events match your search query.
                          </td>
                        </tr>
                      ) : (
                        filteredAudit.map((log) => (
                          <tr key={log.id}>
                            <td>
                              <code
                                style={{
                                  background: "#f0f9ff",
                                  color: "#0284c7",
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                }}
                              >
                                {log.action}
                              </code>
                            </td>
                            <td>
                              <span style={{ color: "#334155" }}>{log.entityType}</span>
                            </td>
                            <td>
                              <strong style={{ color: "#0f172a", fontSize: 12 }}>{log.actor}</strong>
                            </td>
                            <td>
                              <span style={{ color: "#64748b" }}>{log.organisation}</span>
                            </td>
                            <td>
                              <span style={{ color: "#64748b", fontSize: 11.5 }}>
                                {new Date(log.createdAt).toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM HEALTH */}
          {activeTab === "health" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="stats-grid">
                <StatCard
                  label="PostgreSQL Status"
                  value={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="live-pulse-dot" />
                      <span>Connected</span>
                    </span>
                  }
                  change="RLS Zero-Trust Enforced"
                  icon="shield"
                  tone="teal"
                />
                <StatCard
                  label="API Server Uptime"
                  value={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="live-pulse-dot" />
                      <span>{health ? `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m` : "Active"}</span>
                    </span>
                  }
                  change="PM2 Managed"
                  icon="activity"
                  tone="blue"
                />
                <StatCard
                  label="Memory Usage (RSS)"
                  value={health ? `${health.system.rssMemoryMb} MB` : "Normal"}
                  change={`Heap: ${health?.system.heapUsedMb || 0} MB`}
                  icon="services"
                  tone="amber"
                />
                <StatCard
                  label="Audited System Logs"
                  value={health?.database.counts.auditLogs || auditLogs.length}
                  change="Immutable records"
                  icon="building"
                  tone="purple"
                />
              </div>

              <div className="section-card" style={{ padding: 18 }}>
                <h2 style={{ color: "#0f172a", margin: "0 0 12px", fontSize: 14.5 }}>
                  Database Telemetry & Model Row Counts
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  {[
                    { label: "Organisations (Tenants)", count: health?.database.counts.organisations ?? organisations.length },
                    { label: "Users & Accounts", count: health?.database.counts.users ?? data?.stats.totalUsers ?? 0 },
                    { label: "People / Contacts", count: health?.database.counts.people ?? 0 },
                    { label: "Invoices Generated", count: health?.database.counts.invoices ?? 0 },
                    { label: "CRM Leads & Deals", count: health?.database.counts.leads ?? 0 },
                    { label: "Audit Ledger Records", count: health?.database.counts.auditLogs ?? auditLogs.length },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        padding: 12,
                        background: "#f8fafc",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <span style={{ color: "#64748b", fontSize: 11, display: "block", marginBottom: 3 }}>
                        {item.label}
                      </span>
                      <strong style={{ color: "#0f172a", fontSize: 20, fontWeight: 800 }}>
                        {item.count}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODAL 1: MANAGE TENANT DETAIL & SERVICES */}
          <Modal
            isOpen={Boolean(selectedOrg)}
            onClose={() => setSelectedOrg(null)}
            title={selectedOrg?.name || "Manage Tenant"}
            subtitle="Tenant Configuration & Entitlements"
            maxWidth={640}
          >
            {selectedOrg && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Tenant ID Banner */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "#f8fafc",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <small style={{ color: "#64748b", display: "block", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>
                      Tenant Isolation UUID (PostgreSQL Key)
                    </small>
                    <code style={{ color: "#0284c7", fontSize: 12, wordBreak: "break-all", fontWeight: 600 }}>
                      {selectedOrg.id}
                    </code>
                  </div>
                  <button
                    className={`copy-id-button${copiedId ? " copied" : ""}`}
                    onClick={() => copyTenantId(selectedOrg.id)}
                    style={{ flexShrink: 0 }}
                  >
                    <Icon name={copiedId ? "check" : "copy"} size={13} />
                    <span>{copiedId ? "Copied!" : "Copy"}</span>
                  </button>
                </div>

                {/* Status & Quick Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 11, display: "block" }}>Operational Status</span>
                    <strong style={{ color: selectedOrg.status === "ACTIVE" ? "#16a34a" : "#dc2626", fontSize: 13, fontWeight: 700 }}>
                      ● {selectedOrg.status}
                    </strong>
                  </div>
                  <button
                    className={selectedOrg.status === "ACTIVE" ? "danger-button" : "primary-btn"}
                    disabled={savingOrg}
                    onClick={() => handleToggleOrgStatus(selectedOrg)}
                    style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12 }}
                  >
                    {savingOrg ? "Updating…" : selectedOrg.status === "ACTIVE" ? "Suspend Workspace" : "Activate Workspace"}
                  </button>
                </div>

                {/* Metadata Details */}
                <div className="key-value-list">
                  <div className="key-value-row">
                    <span className="key-value-label">
                      <Icon name="tag" size={13} /> Business Type
                    </span>
                    <strong className="key-value-value" style={{ color: "#0f172a", fontSize: 12 }}>{selectedOrg.businessType}</strong>
                  </div>
                  <div className="key-value-row">
                    <span className="key-value-label">
                      <Icon name="rupee" size={13} /> Currency & Timezone
                    </span>
                    <strong className="key-value-value" style={{ color: "#0f172a", fontSize: 12 }}>{selectedOrg.currency} · {selectedOrg.timezone}</strong>
                  </div>
                  <div className="key-value-row">
                    <span className="key-value-label">
                      <Icon name="calendar" size={13} /> Onboarded Date
                    </span>
                    <strong className="key-value-value" style={{ color: "#0f172a", fontSize: 12 }}>{new Date(selectedOrg.createdAt).toLocaleDateString()}</strong>
                  </div>
                  <div className="key-value-row">
                    <span className="key-value-label">
                      <Icon name="people" size={13} /> Team Members
                    </span>
                    <strong className="key-value-value" style={{ color: "#0f172a", fontSize: 12 }}>{selectedOrg.memberCount} members ({selectedOrg.peopleCount} contacts)</strong>
                  </div>
                </div>

                {/* Service Entitlements Configuration */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ color: "#0f172a", fontSize: 13 }}>Modular Service Entitlements</strong>
                      <p style={{ color: "#64748b", fontSize: 11, margin: "2px 0 0" }}>
                        Enable or disable individual business applications for this tenant.
                      </p>
                    </div>
                    <button
                      className="primary-btn"
                      disabled={savingOrg}
                      onClick={() => handleSaveServices(selectedOrg)}
                      style={{ padding: "5px 12px", fontSize: 11, borderRadius: 6 }}
                    >
                      {savingOrg ? "Saving…" : "Save Entitlements"}
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ALL_AVAILABLE_SERVICES.map((s) => {
                      const isChecked = editableServices.includes(s.code);
                      return (
                        <label
                          key={s.code}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 12px",
                            background: isChecked ? "#f0f9ff" : "#ffffff",
                            border: `1px solid ${isChecked ? "#bae6fd" : "#e2e8f0"}`,
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditableServices((prev) => [...prev, s.code]);
                              } else {
                                setEditableServices((prev) => prev.filter((c) => c !== s.code));
                              }
                            }}
                            style={{ accentColor: "#0284c7", width: 15, height: 15 }}
                          />
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: "#0f172a", fontSize: 12, display: "block" }}>{s.name}</strong>
                            <small style={{ color: "#64748b", fontSize: 10.5 }}>{s.desc}</small>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Danger Zone: Permanent Deletion */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginTop: 6,
                    padding: "14px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <strong style={{ color: "#dc2626", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="alertCircle" size={14} /> Danger Zone: Permanent Deletion
                      </strong>
                      <p style={{ color: "#991b1b", fontSize: 11, margin: "3px 0 0", lineHeight: 1.4 }}>
                        Purge workspace records & free up owner account email for testing fresh re-registration.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOrgToDelete(selectedOrg);
                        setDeleteOwnerUser(true);
                        setConfirmOrgNameInput("");
                      }}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 6,
                        background: "#dc2626",
                        color: "#ffffff",
                        border: "none",
                        fontWeight: 600,
                        fontSize: 11.5,
                        cursor: "pointer",
                      }}
                    >
                      Delete Workspace Permanently
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Modal>

          {/* MODAL: CONFIRM PERMANENT DELETION */}
          <Modal
            isOpen={Boolean(orgToDelete)}
            onClose={() => {
              if (!deletingOrg) setOrgToDelete(null);
            }}
            title="Confirm Permanent Deletion"
            subtitle={`Deleting "${orgToDelete?.name}"`}
            maxWidth={520}
          >
            {orgToDelete && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    padding: "12px",
                    borderRadius: 8,
                    color: "#991b1b",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ display: "block", color: "#dc2626", marginBottom: 3 }}>
                    ⚠️ Irreversible Testing Action
                  </strong>
                  All PostgreSQL records for <strong>{orgToDelete.name}</strong> ({orgToDelete.slug}) including CRM leads, contacts, invoices, payroll entries, and entitlements will be permanently wiped.
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    background: "#f8fafc",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={deleteOwnerUser}
                    onChange={(e) => setDeleteOwnerUser(e.target.checked)}
                    style={{ accentColor: "#dc2626", width: 16, height: 16, marginTop: 2 }}
                  />
                  <div>
                    <strong style={{ color: "#0f172a", fontSize: 12, display: "block" }}>
                      Wipe owner user account (Free up email for re-registration)
                    </strong>
                    <small style={{ color: "#64748b", fontSize: 11, lineHeight: 1.4, display: "block", marginTop: 3 }}>
                      Purges the owner account and OTP challenges so you can immediately re-register with the same email during onboarding testing.
                    </small>
                  </div>
                </label>

                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
                    Type organisation name <strong style={{ color: "#0284c7" }}>{orgToDelete.name}</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    placeholder={`Type "${orgToDelete.name}"`}
                    value={confirmOrgNameInput}
                    onChange={(e) => setConfirmOrgNameInput(e.target.value)}
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

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={deletingOrg}
                    onClick={() => setOrgToDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteDeleteOrg}
                    disabled={
                      deletingOrg ||
                      confirmOrgNameInput.trim().toLowerCase() !== orgToDelete.name.trim().toLowerCase()
                    }
                    style={{
                      padding: "7px 14px",
                      borderRadius: 6,
                      background:
                        confirmOrgNameInput.trim().toLowerCase() === orgToDelete.name.trim().toLowerCase()
                          ? "#dc2626"
                          : "#94a3b8",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor:
                        confirmOrgNameInput.trim().toLowerCase() === orgToDelete.name.trim().toLowerCase()
                          ? "pointer"
                          : "not-allowed",
                    }}
                  >
                    {deletingOrg ? "Deleting Workspace…" : "Delete Workspace Permanently"}
                  </button>
                </div>
              </div>
            )}
          </Modal>

          {/* MODAL 2: ONBOARD NEW TENANT */}
          <Modal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            title="Onboard New Tenant"
            subtitle="Provision a fresh multi-tenant PostgreSQL workspace"
            maxWidth={540}
          >
            <form onSubmit={handleCreateOrg} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Business / Organisation Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Global Logistics"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Business Type *</label>
                  <select
                    value={newOrgBusinessType}
                    onChange={(e) => {
                      setNewOrgBusinessType(e.target.value);
                      if (e.target.value !== "Other") {
                        setNewOrgCustomBusinessType("");
                      }
                    }}
                    required
                  >
                    {BUSINESS_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Operating Currency</label>
                  <select
                    value={newOrgCurrency}
                    onChange={(e) => setNewOrgCurrency(e.target.value)}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              {newOrgBusinessType === "Other" && (
                <div className="field" style={{ animation: "slideDown 0.2s ease-out" }}>
                  <label>Specify Custom Business Type *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Photography Studio, Event Decor, Solar Solutions…"
                    value={newOrgCustomBusinessType}
                    onChange={(e) => setNewOrgCustomBusinessType(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <div className="field">
                <label>Initial Owner / Admin Email (Optional)</label>
                <input
                  type="email"
                  placeholder="owner@example.com"
                  value={newOrgOwnerEmail}
                  onChange={(e) => setNewOrgOwnerEmail(e.target.value)}
                />
                <small style={{ color: "#64748b", marginTop: 4 }}>
                  If provided, this user will automatically receive owner role permissions.
                </small>
              </div>

              <div className="field">
                <label>Initial Module Entitlements</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                  {ALL_AVAILABLE_SERVICES.map((s) => {
                    const isChecked = newOrgServices.includes(s.code);
                    return (
                      <label
                        key={s.code}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "7px 10px",
                          background: isChecked ? "#f0f9ff" : "#ffffff",
                          border: `1px solid ${isChecked ? "#bae6fd" : "#e2e8f0"}`,
                          borderRadius: 6,
                          fontSize: 11.5,
                          color: "#0f172a",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewOrgServices((prev) => [...prev, s.code]);
                            } else {
                              setNewOrgServices((prev) => prev.filter((c) => c !== s.code));
                            }
                          }}
                          style={{ accentColor: "#0284c7" }}
                        />
                        <span style={{ fontWeight: 600 }}>{s.code.toUpperCase()}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={savingOrg || !newOrgName.trim()}
                >
                  {savingOrg ? "Provisioning…" : "Provision Workspace"}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </AppShell>
  );
}
