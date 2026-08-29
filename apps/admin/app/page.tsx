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

const nav: NavItem[] = [
  { label: "Platform Overview", icon: "home", href: "#overview" },
  { label: "Organisations & Tenants", icon: "building", href: "#organisations" },
  { label: "Services & Adoption", icon: "services", href: "#services" },
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
  const api =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" && window.location.hostname.endsWith("crmkaro.com")
      ? "https://api.crmkaro.com/api/v1"
      : "http://localhost:4000/api/v1");

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<"overview" | "organisations" | "services" | "audit" | "health">("overview");

  // Data states
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationDetail[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Search & Filter states
  const [orgSearch, setOrgSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [auditSearch, setAuditSearch] = useState("");

  // Modals state
  const [selectedOrg, setSelectedOrg] = useState<OrganisationDetail | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

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
      if (["overview", "organisations", "services", "audit", "health"].includes(hash)) {
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
      const res = await fetch(`${api}/platform/overview`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load platform overview.");
      const overviewData = await res.json();
      setData(overviewData);

      // 2. All organisations
      const orgsRes = await fetch(`${api}/platform/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        setOrganisations(orgsData.organisations || []);
      }

      // 3. Full Audit logs
      const auditRes = await fetch(`${api}/platform/audit?limit=100`, { credentials: "include" });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs || []);
      }

      // 4. System Health
      const healthRes = await fetch(`${api}/platform/health`, { credentials: "include" });
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
      await fetch(`${api}/auth/logout`, {
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
      const res = await fetch(`${api}/platform/organisations/${org.id}/status`, {
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
      const res = await fetch(`${api}/platform/organisations/${org.id}/services`, {
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
      const res = await fetch(`${api}/platform/organisations`, {
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
      dark
      currentPath={`#${activeTab}`}
      userName="Super Admin"
      userRole="Platform Administrator"
    >
      {/* Toast Feedback */}
      {feedback && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 10,
            background: feedback.type === "success" ? "#064e3b" : "#7f1d1d",
            color: "#ffffff",
            border: `1px solid ${feedback.type === "success" ? "#059669" : "#dc2626"}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Icon name={feedback.type === "success" ? "checkCircle" : "alertCircle"} size={16} />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="shield" size={14} /> Restricted Platform Console
          </p>
          <h1>Platform Operations Console</h1>
          <p className="subheading">
            Live multi-tenant telemetry, tenant provisioning, service entitlements, and append-only audit.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="secondary-btn"
            onClick={loadData}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8 }}
          >
            <Icon name="activity" size={14} />
            <span>Refresh Telemetry</span>
          </button>
          <button
            className="primary-btn"
            onClick={() => setCreateModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8 }}
          >
            <Icon name="plus" size={15} />
            <span>+ Onboard Tenant</span>
          </button>
          <button
            className="secondary-btn"
            onClick={handleAdminLogout}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              color: "#f87171",
              border: "1px solid #7f1d1d",
              background: "rgba(127, 29, 29, 0.2)",
              cursor: "pointer",
            }}
            title="Sign out of platform admin console"
          >
            <Icon name="logout" size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-nav-tabs" style={{ display: "flex", gap: 8, borderBottom: "1px solid #1e293b", paddingBottom: 12, marginBottom: 24, overflowX: "auto" }}>
        {[
          { key: "overview", label: "Platform Overview", icon: "home" },
          { key: "organisations", label: `Tenants (${organisations.length})`, icon: "building" },
          { key: "services", label: "Services & Adoption", icon: "services" },
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
                gap: 8,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: isActive ? "rgba(56, 189, 248, 0.15)" : "transparent",
                color: isActive ? "#38bdf8" : "#94a3b8",
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Icon name={tab.icon as any} size={15} />
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
                  value="RLS Isolated"
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {data?.adoption.map((s) => (
                      <div key={s.code} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <strong style={{ color: "#ffffff" }}>{s.name}</strong>
                          <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                            {s.count} tenants ({s.percentage}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: 8,
                            background: "#1e293b",
                            borderRadius: 4,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.max(s.percentage, 8)}%`,
                              background: "linear-gradient(90deg, #0284c7, #38bdf8)",
                              borderRadius: 4,
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
                  padding: "16px 20px",
                  background: "#0f172a",
                  borderRadius: 12,
                  border: "1px solid #1e293b",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 260 }}>
                  <Icon name="search" size={16} />
                  <input
                    type="text"
                    placeholder="Search tenants by name, slug, or type…"
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      color: "#ffffff",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  {orgSearch && (
                    <button
                      onClick={() => setOrgSearch("")}
                      style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      color: "#ffffff",
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="SUSPENDED">Suspended Only</option>
                  </select>

                  <button
                    className="primary-btn"
                    onClick={() => setCreateModalOpen(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8 }}
                  >
                    <Icon name="plus" size={14} />
                    <span>Onboard Tenant</span>
                  </button>
                </div>
              </div>

              {/* Tenants Table */}
              <div className="section-card" style={{ padding: 0 }}>
                <header style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
                  <div>
                    <h2 style={{ color: "#ffffff", margin: 0, fontSize: 15 }}>
                      Registered Workspaces ({filteredOrgs.length})
                    </h2>
                    <p style={{ color: "#94a3b8", margin: "2px 0 0", fontSize: 12 }}>
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
                          <td colSpan={8} style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8" }}>
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
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 8,
                                    background: "linear-gradient(135deg, #0284c7, #38bdf8)",
                                    color: "#ffffff",
                                    display: "grid",
                                    placeItems: "center",
                                    fontWeight: 700,
                                    fontSize: 13,
                                  }}
                                >
                                  {org.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <strong style={{ color: "#ffffff", display: "block" }}>{org.name}</strong>
                                  <small style={{ color: "#64748b" }}>{org.slug}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ color: "#cbd5e1", display: "block" }}>{org.businessType}</span>
                              <small style={{ color: "#64748b" }}>{org.currency} ({org.timezone})</small>
                            </td>
                            <td>
                              <Badge tone={org.status === "ACTIVE" ? "green" : "neutral"}>
                                {org.status}
                              </Badge>
                            </td>
                            <td>
                              <span style={{ color: "#ffffff", fontWeight: 600 }}>{org.memberCount}</span>
                              <small style={{ color: "#64748b", display: "block" }}>users</small>
                            </td>
                            <td>
                              <span style={{ color: "#cbd5e1" }}>{org.peopleCount} contacts</span>
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
                                      background: "rgba(56, 189, 248, 0.1)",
                                      color: "#38bdf8",
                                      border: "1px solid rgba(56, 189, 248, 0.2)",
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
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div className="section-card" style={{ padding: 24 }}>
                <h2 style={{ color: "#ffffff", margin: "0 0 6px" }}>Platform Service Modules & Entitlements</h2>
                <p style={{ color: "#94a3b8", margin: 0, fontSize: 13 }}>
                  CRMKaro modular architecture lets you provision and enable specific capabilities per organisation tenant.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
                {ALL_AVAILABLE_SERVICES.map((s) => {
                  const adoption = data?.adoption.find((a) => a.code === s.code);
                  const count = adoption?.count || 0;
                  const percentage = adoption?.percentage || 0;

                  return (
                    <div
                      key={s.code}
                      className="section-card"
                      style={{
                        padding: 24,
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        border: "1px solid #1e293b",
                        background: "#0f172a",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 10,
                              background: "rgba(56, 189, 248, 0.15)",
                              color: "#38bdf8",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <Icon name={s.code === "people" ? "people" : s.code === "crm" ? "activity" : s.code === "finance" ? "rupee" : s.code === "payroll" ? "calendar" : "tag"} size={20} />
                          </div>
                          <div>
                            <strong style={{ color: "#ffffff", fontSize: 16, display: "block" }}>{s.name}</strong>
                            <code style={{ color: "#38bdf8", fontSize: 11 }}>module: {s.code}</code>
                          </div>
                        </div>
                        <Badge tone="green">Active</Badge>
                      </div>

                      <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                        {s.desc}
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto", paddingTop: 14, borderTop: "1px solid #1e293b" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#94a3b8" }}>Adoption Rate:</span>
                          <strong style={{ color: "#ffffff" }}>{count} tenants ({percentage}%)</strong>
                        </div>
                        <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.max(percentage, 5)}%`, background: "#38bdf8" }} />
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
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "16px 20px",
                  background: "#0f172a",
                  borderRadius: 12,
                  border: "1px solid #1e293b",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  <Icon name="search" size={16} />
                  <input
                    type="text"
                    placeholder="Search audit logs by action, actor, or organisation…"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      color: "#ffffff",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  {auditSearch && (
                    <button
                      onClick={() => setAuditSearch("")}
                      style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="section-card" style={{ padding: 0 }}>
                <header style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
                  <div>
                    <h2 style={{ color: "#ffffff", margin: 0, fontSize: 15 }}>
                      Global Platform Audit Trail ({filteredAudit.length} events)
                    </h2>
                    <p style={{ color: "#94a3b8", margin: "2px 0 0", fontSize: 12 }}>
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
                          <td colSpan={5} style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8" }}>
                            No audit events match your search query.
                          </td>
                        </tr>
                      ) : (
                        filteredAudit.map((log) => (
                          <tr key={log.id}>
                            <td>
                              <code
                                style={{
                                  background: "rgba(56, 189, 248, 0.1)",
                                  color: "#38bdf8",
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {log.action}
                              </code>
                            </td>
                            <td>
                              <span style={{ color: "#cbd5e1" }}>{log.entityType}</span>
                            </td>
                            <td>
                              <strong style={{ color: "#ffffff" }}>{log.actor}</strong>
                            </td>
                            <td>
                              <span style={{ color: "#94a3b8" }}>{log.organisation}</span>
                            </td>
                            <td>
                              <span style={{ color: "#64748b", fontSize: 12 }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div className="stats-grid">
                <StatCard
                  label="PostgreSQL Status"
                  value="Connected"
                  change="RLS Zero-Trust Enforced"
                  icon="shield"
                  tone="teal"
                />
                <StatCard
                  label="API Server Uptime"
                  value={health ? `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m` : "Active"}
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

              <div className="section-card" style={{ padding: 24 }}>
                <h2 style={{ color: "#ffffff", margin: "0 0 16px", fontSize: 16 }}>
                  Database Telemetry & Model Row Counts
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
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
                        padding: 16,
                        background: "#1e293b",
                        borderRadius: 10,
                        border: "1px solid #334155",
                      }}
                    >
                      <span style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>
                        {item.label}
                      </span>
                      <strong style={{ color: "#ffffff", fontSize: 24, fontWeight: 800 }}>
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
                    padding: "12px 16px",
                    background: "#1e293b",
                    borderRadius: 10,
                    border: "1px solid #334155",
                  }}
                >
                  <div>
                    <small style={{ color: "#94a3b8", display: "block", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>
                      Tenant Isolation UUID (PostgreSQL Key)
                    </small>
                    <code style={{ color: "#38bdf8", fontSize: 13, wordBreak: "break-all" }}>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#090e17", borderRadius: 10, border: "1px solid #1e293b" }}>
                  <div>
                    <span style={{ color: "#94a3b8", fontSize: 12, display: "block" }}>Operational Status</span>
                    <strong style={{ color: selectedOrg.status === "ACTIVE" ? "#4ade80" : "#f87171", fontSize: 15 }}>
                      ● {selectedOrg.status}
                    </strong>
                  </div>
                  <button
                    className={selectedOrg.status === "ACTIVE" ? "danger-button" : "primary-btn"}
                    disabled={savingOrg}
                    onClick={() => handleToggleOrgStatus(selectedOrg)}
                    style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13 }}
                  >
                    {savingOrg ? "Updating…" : selectedOrg.status === "ACTIVE" ? "Suspend Workspace" : "Activate Workspace"}
                  </button>
                </div>

                {/* Metadata Details */}
                <div className="key-value-list">
                  <div className="key-value-row">
                    <span className="key-value-label">
                      <Icon name="tag" size={14} /> Business Type
                    </span>
                    <strong className="key-value-value" style={{ color: "#ffffff" }}>{selectedOrg.businessType}</strong>
                  </div>
                  <div className="key-value-row">
                    <span className="key-value-label">
                      <Icon name="rupee" size={14} /> Currency & Timezone
                    </span>
                    <strong className="key-value-value" style={{ color: "#ffffff" }}>{selectedOrg.currency} · {selectedOrg.timezone}</strong>
                  </div>
                  <div className="key-value-row">
                    <span className="key-value-label">
                      <Icon name="calendar" size={14} /> Onboarded Date
                    </span>
                    <strong className="key-value-value" style={{ color: "#ffffff" }}>{new Date(selectedOrg.createdAt).toLocaleDateString()}</strong>
                  </div>
                  <div className="key-value-row">
                    <span className="key-value-label">
                      <Icon name="people" size={14} /> Team Members
                    </span>
                    <strong className="key-value-value" style={{ color: "#ffffff" }}>{selectedOrg.memberCount} members ({selectedOrg.peopleCount} contacts)</strong>
                  </div>
                </div>

                {/* Service Entitlements Configuration */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 16, borderTop: "1px solid #1e293b" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ color: "#ffffff", fontSize: 14 }}>Modular Service Entitlements</strong>
                      <p style={{ color: "#94a3b8", fontSize: 11, margin: "2px 0 0" }}>
                        Enable or disable individual business applications for this tenant.
                      </p>
                    </div>
                    <button
                      className="primary-btn"
                      disabled={savingOrg}
                      onClick={() => handleSaveServices(selectedOrg)}
                      style={{ padding: "6px 14px", fontSize: 12, borderRadius: 6 }}
                    >
                      {savingOrg ? "Saving…" : "Save Entitlements"}
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {ALL_AVAILABLE_SERVICES.map((s) => {
                      const isChecked = editableServices.includes(s.code);
                      return (
                        <label
                          key={s.code}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 14px",
                            background: isChecked ? "rgba(56, 189, 248, 0.08)" : "#1e293b",
                            border: `1px solid ${isChecked ? "rgba(56, 189, 248, 0.3)" : "#334155"}`,
                            borderRadius: 8,
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
                            style={{ accentColor: "#38bdf8", width: 16, height: 16 }}
                          />
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: "#ffffff", fontSize: 13, display: "block" }}>{s.name}</strong>
                            <small style={{ color: "#94a3b8", fontSize: 11 }}>{s.desc}</small>
                          </div>
                        </label>
                      );
                    })}
                  </div>
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
            <form onSubmit={handleCreateOrg} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                          padding: "8px 10px",
                          background: isChecked ? "rgba(56, 189, 248, 0.1)" : "#1e293b",
                          border: `1px solid ${isChecked ? "#38bdf8" : "#334155"}`,
                          borderRadius: 6,
                          fontSize: 12,
                          color: "#ffffff",
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
                          style={{ accentColor: "#38bdf8" }}
                        />
                        <span>{s.code.toUpperCase()}</span>
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
