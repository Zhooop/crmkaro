"use client";

import {
  AppShell,
  Badge,
  EmptyState,
  Icon,
  SectionCard,
  StatCard,
  Tabs,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import {
  ALL_AVAILABLE_SERVICES,
  buildNavItems,
  getActiveServicesFromStorage,
  saveActiveServicesToStorage,
} from "@/lib/nav";

type Role = {
  id: string;
  name: string;
  code: string;
  isSystem: boolean;
};

type Member = {
  id: string;
  userId: string;
  roleId: string;
  status: "ACTIVE" | "INVITED" | "DISABLED";
  user: { name: string | null; email: string };
  role: Role;
  joinedAt: string | null;
};

type ServiceItem = {
  code: string;
  name: string;
  status: "ACTIVE" | "DISABLED" | "TRIAL" | "PENDING";
  enabled: boolean;
};

type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor?: { name: string | null; email: string };
  createdAt: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const api = getApiUrl();

  // Data states
  const [activeTab, setActiveTab] = useState<"profile" | "team" | "services" | "audit">("profile");
  const [orgDetails, setOrgDetails] = useState<{
    id: string;
    name: string;
    slug?: string;
    businessType?: string;
    currency?: string;
    timezone?: string;
    createdAt?: string;
  } | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [activeServiceCodes, setActiveServiceCodes] = useState<string[]>(getActiveServicesFromStorage);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  // Context & AppShell info
  const [orgName, setOrgName] = useState("CRMKaro Workspace");
  const [userName, setUserName] = useState("Workspace User");
  const [userRole, setUserRole] = useState("Admin");
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);

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
          setOrgDetails(activeOrgEntry.organisation);
          setUserRole(activeOrgEntry.role?.name || "Admin");
          if (activeOrgEntry.activeServices || activeOrgEntry.organisation.activeServices) {
            const list = activeOrgEntry.activeServices || activeOrgEntry.organisation.activeServices;
            setActiveServiceCodes(list);
            saveActiveServicesToStorage(list);
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

  // Load team & roles
  const loadTeam = useCallback(async () => {
    try {
      const rolesRes = await authFetch(`${api}/access/roles`, { credentials: "include" });
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  // Load Services
  const loadServices = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/access/services`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setServices(data || []);
        const activeList = data.filter((s: ServiceItem) => s.enabled).map((s: ServiceItem) => s.code);
        setActiveServiceCodes(activeList);
        saveActiveServicesToStorage(activeList);
      }
    } catch {
      // ignore
    }
  }, [api]);

  // Load Audit
  const loadAudit = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/access/audit?limit=50`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.items || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  useEffect(() => {
    loadContext();
    loadTeam();
    loadServices();
    loadAudit();
    setLoading(false);
  }, [loadContext, loadTeam, loadServices, loadAudit]);

  async function handleToggleService(serviceCode: string, currentlyEnabled: boolean) {
    setTogglingCode(serviceCode);
    try {
      const action = currentlyEnabled ? "disable" : "enable";
      const res = await authFetch(`${api}/access/services/${serviceCode}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await loadServices();
      }
    } catch {
      // ignore
    } finally {
      setTogglingCode(null);
    }
  }

  const tabItems = [
    { id: "profile", label: "Workspace Profile" },
    { id: "services", label: "Services & Modules", count: services.filter((s) => s.enabled).length },
    { id: "team", label: "Team & Roles", count: roles.length },
    { id: "audit", label: "Security Audit Log", count: auditLogs.length },
  ];

  const [copiedId, setCopiedId] = useState(false);

  function copyTenantId() {
    if (orgDetails?.id) {
      navigator.clipboard.writeText(orgDetails.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  }

  const initials = (orgDetails?.name || orgName)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const nav: NavItem[] = buildNavItems(activeServiceCodes);

  return (
    <AppShell
      currentPath="/settings"
      nav={nav}
      organisation={orgName}
      organisations={organisations}
      product="CRMKaro"
      userName={userName}
      userRole={userRole}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
    >
      <div className="page-heading">
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            <Icon name="settings" size={15} /> System Configuration & Modules
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", margin: 0, letterSpacing: "-0.02em" }}>
            Workspace Settings
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "4px 0 0" }}>
            Manage organization identity, enable/archive business services, team roles, and security audit logs.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Tabs
          active={activeTab}
          items={tabItems}
          onChange={(id) => setActiveTab(id as any)}
        />
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div>
          {/* Org Profile Header Card */}
          <div className="profile-hero-card">
            <div className="profile-avatar-lg">{initials}</div>
            <div className="profile-hero-meta">
              <div className="profile-hero-title-row">
                <h2>{orgDetails?.name || orgName}</h2>
                <Badge tone="blue">Production Tenant</Badge>
              </div>
              <p className="profile-hero-subtitle">
                <span>Domain Slug:</span>
                <code>{orgDetails?.slug || "crmkaro-primary"}</code>
                <span>·</span>
                <span>{orgDetails?.businessType || "Business"}</span>
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <StatCard
              label="Active Enabled Modules"
              value={`${services.filter((s) => s.enabled).length} of ${ALL_AVAILABLE_SERVICES.length}`}
              change="Configurable on Services tab"
              icon="services"
            />
            <StatCard
              label="Assigned Roles"
              value={roles.length.toString()}
              change="Strict RBAC Matrix"
              icon="shield"
            />
            <StatCard
              label="Audited Events"
              value={auditLogs.length.toString()}
              change="PostgreSQL Append-Only"
              icon="activity"
            />
          </div>

          {/* Two Detailed Cards */}
          <div className="profile-detail-grid">
            <SectionCard title="Organisation Metadata" subtitle="Core workspace identification & regional settings">
              <div className="key-value-list">
                <div className="key-value-row">
                  <span className="key-value-label">
                    <Icon name="building" size={14} />
                    <span>Business Name</span>
                  </span>
                  <span className="key-value-value">{orgDetails?.name || orgName}</span>
                </div>

                <div className="key-value-row">
                  <span className="key-value-label">
                    <Icon name="tag" size={14} />
                    <span>Business Type</span>
                  </span>
                  <span className="key-value-value">{orgDetails?.businessType || "Business"}</span>
                </div>

                <div className="key-value-row">
                  <span className="key-value-label">
                    <Icon name="refresh" size={14} />
                    <span>Operating Timezone</span>
                  </span>
                  <span className="key-value-value">{orgDetails?.timezone || "Asia/Kolkata (IST, UTC+05:30)"}</span>
                </div>

                <div className="key-value-row">
                  <span className="key-value-label">
                    <Icon name="finance" size={14} />
                    <span>Workspace Currency</span>
                  </span>
                  <span className="key-value-value">{orgDetails?.currency || "INR (₹ Indian Rupee)"}</span>
                </div>

                <div className="key-value-row">
                  <span className="key-value-label">
                    <Icon name="building" size={14} />
                    <span>Deployment Tier</span>
                  </span>
                  <span className="key-value-value">
                    <Badge tone="blue">Enterprise Multi-Tenant</Badge>
                  </span>
                </div>

                <div className="key-value-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                  <span className="key-value-label">
                    <Icon name="shield" size={14} />
                    <span>Tenant UUID (PostgreSQL Isolation Key)</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                    <code className="code-chip" style={{ flex: 1 }}>
                      {orgDetails?.id || "82cb99ee-077f-4a37-8c34-e9f22231a0bf"}
                    </code>
                    <button
                      className="secondary-button"
                      onClick={copyTenantId}
                      style={{ padding: "4px 8px", fontSize: 11 }}
                    >
                      {copiedId ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Data Isolation & Compliance" subtitle="Engine-level security & immutable audit logging">
              <div className="security-banner">
                <Icon name="checkCircle" size={16} />
                <span>Zero-Leakage Multi-Tenancy Active</span>
              </div>

              <div className="security-checklist">
                <div className="security-item">
                  <div className="security-item-icon">
                    <Icon name="shield" size={16} />
                  </div>
                  <div className="security-item-text">
                    <strong>PostgreSQL Row-Level Security (RLS)</strong>
                    <p>Database queries are partitioned at the PostgreSQL kernel level. Cross-tenant leakage is impossible.</p>
                  </div>
                </div>

                <div className="security-item">
                  <div className="security-item-icon">
                    <Icon name="checkCircle" size={16} />
                  </div>
                  <div className="security-item-text">
                    <strong>Append-Only Audit Trail</strong>
                    <p>Every create, update, and delete operation is signed and logged with actor metadata.</p>
                  </div>
                </div>

                <div className="security-item">
                  <div className="security-item-icon">
                    <Icon name="shield" size={16} />
                  </div>
                  <div className="security-item-text">
                    <strong>HttpOnly Encrypted Sessions</strong>
                    <p>Browser credentials use 256-bit signed tokens with SameSite=Lax protection against XSS and CSRF.</p>
                  </div>
                </div>

                <div className="security-item">
                  <div className="security-item-icon">
                    <Icon name="activity" size={16} />
                  </div>
                  <div className="security-item-text">
                    <strong>Role-Based Access Control (RBAC)</strong>
                    <p>Granular permissions (Owner, Admin, Manager, Staff) enforced before every route handler.</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* Services Entitlements Tab */}
      {activeTab === "services" && (
        <div style={{ maxWidth: 840 }}>
          <div style={{ marginBottom: 20, padding: "16px 20px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 750, color: "var(--ink)" }}>
              🧩 Active Workspace Services & Navigation Visibility
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              Enable or archive business services. <strong>Archived / disabled services are immediately hidden from the sidebar menu</strong> across all pages and protected from unauthorized data entry.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ALL_AVAILABLE_SERVICES.map((srv) => {
              const currentSrv = services.find((s) => s.code === srv.code);
              const isEnabled = currentSrv ? currentSrv.enabled : activeServiceCodes.includes(srv.code);
              const isBusy = togglingCode === srv.code;

              return (
                <div
                  key={srv.code}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "18px 22px",
                    background: "#fff",
                    border: isEnabled ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                    borderRadius: 12,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    opacity: isEnabled ? 1 : 0.75,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: isEnabled ? "#eff6ff" : "#f1f5f9",
                        color: isEnabled ? "var(--brand)" : "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={srv.icon} size={22} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <strong style={{ fontSize: 14.5, color: "var(--ink)" }}>{srv.name}</strong>
                        <Badge tone={isEnabled ? "green" : "neutral"}>
                          {isEnabled ? "ACTIVE (IN MENU)" : "ARCHIVED (HIDDEN)"}
                        </Badge>
                      </div>
                      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 0" }}>
                        {srv.desc}
                      </p>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleService(srv.code, isEnabled)}
                      style={{
                        padding: "7px 16px",
                        fontSize: 12.5,
                        fontWeight: 700,
                        borderRadius: 8,
                        cursor: "pointer",
                        border: isEnabled ? "1px solid #fecaca" : "1px solid var(--brand)",
                        background: isEnabled ? "#fef2f2" : "var(--brand)",
                        color: isEnabled ? "#b91c1c" : "#ffffff",
                        transition: "all 0.15s ease",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {isBusy
                        ? "Updating…"
                        : isEnabled
                          ? "Archive & Hide from Menu"
                          : "+ Enable & Show in Menu"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team & Roles Tab */}
      {activeTab === "team" && (
        <div style={{ maxWidth: 840 }}>
          <div className="table-responsive" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>System Preset</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>
                      <Badge tone={r.isSystem ? "blue" : "neutral"}>
                        {r.isSystem ? "System Role" : "Custom Role"}
                      </Badge>
                    </td>
                    <td style={{ color: "var(--muted)" }}>
                      {r.name === "Owner"
                        ? "Full ownership and tenant billing management."
                        : r.name === "Admin"
                          ? "Full operational and read/write capabilities across all modules."
                          : r.name === "Manager"
                            ? "Can manage customer/student records and team operations."
                            : "Standard operational permissions."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === "audit" && (
        <div style={{ maxWidth: 840 }}>
          {auditLogs.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>
              No audited events logged yet.
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Entity Type</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <strong>{log.action}</strong>
                      </td>
                      <td>
                        <span className="code-chip">{log.entityType}</span>
                      </td>
                      <td>
                        <time style={{ fontSize: 12, color: "var(--muted)" }}>
                          {new Date(log.createdAt).toLocaleString("en-IN")}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
