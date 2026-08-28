"use client";

import {
  AppShell,
  Badge,
  EmptyState,
  Icon,
  SectionCard,
  Tabs,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const nav: NavItem[] = [
  { label: "Dashboard", icon: "home", href: "/" },
  { label: "People", icon: "people", href: "/people" },
  { label: "Leads & CRM", icon: "crm", href: "/crm" },
  { label: "Finance", icon: "finance", href: "/finance" },
  { label: "Payroll", icon: "payroll", href: "/payroll" },
  { label: "Inventory", icon: "inventory", href: "/inventory" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

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
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Context & AppShell info
  const [orgName, setOrgName] = useState("CRMKaro Workspace");
  const [userName, setUserName] = useState("Workspace User");
  const [userRole, setUserRole] = useState("Admin");
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);

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
          setOrgDetails(activeOrgEntry.organisation);
          setUserRole(activeOrgEntry.role?.name || "Admin");
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
      const rolesRes = await fetch(`${api}/access/roles`, { credentials: "include" });
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
      const res = await fetch(`${api}/access/services`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setServices(data || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  // Load Audit
  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch(`${api}/access/audit?limit=50`, { credentials: "include" });
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
    try {
      const action = currentlyEnabled ? "disable" : "enable";
      const res = await fetch(`${api}/access/services/${serviceCode}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        loadServices();
      }
    } catch {
      // ignore
    }
  }

  const tabItems = [
    { id: "profile", label: "Workspace Profile" },
    { id: "services", label: "Services & Modules", count: services.filter((s) => s.enabled).length },
    { id: "team", label: "Team & Roles", count: roles.length },
    { id: "audit", label: "Security Audit Log", count: auditLogs.length },
  ];

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/settings"
      nav={nav}
      userName={userName}
      userRole={userRole}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="settings" size={14} /> Administration
          </p>
          <h1>Workspace Settings & Access</h1>
          <p className="subheading">
            Configure organisation details, manage service entitlements, and audit security events.
          </p>
        </div>
      </div>

      <Tabs
        items={tabItems}
        active={activeTab}
        onChange={(id) => setActiveTab(id as "profile" | "team" | "services" | "audit")}
      />

      {/* Workspace Profile Tab */}
      {activeTab === "profile" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 }}>
          <SectionCard title="Organisation Profile" subtitle="General workspace metadata">
            <div className="key-value-list">
              <div className="key-value-item">
                <label>Business / Workspace Name</label>
                <span>{orgDetails?.name || orgName}</span>
              </div>
              <div className="key-value-item">
                <label>Business Type</label>
                <span>{orgDetails?.businessType || "General Business"}</span>
              </div>
              <div className="key-value-item">
                <label>Currency</label>
                <span>{orgDetails?.currency || "INR (₹)"}</span>
              </div>
              <div className="key-value-item">
                <label>Timezone</label>
                <span>{orgDetails?.timezone || "Asia/Kolkata (IST)"}</span>
              </div>
              <div className="key-value-item">
                <label>Tenant Identifier</label>
                <span>
                  <code>{orgDetails?.id || "Active"}</code>
                </span>
              </div>
              <div className="key-value-item">
                <label>Status</label>
                <span>
                  <Badge tone="green">ACTIVE</Badge>
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Data Isolation & Security" subtitle="Row-Level Security & Compliance">
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>
              Every transaction and record inside this workspace is strictly tenant-isolated at
              the database engine layer.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="checkCircle" size={16} />
                <span>PostgreSQL Row-Level Security active</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="checkCircle" size={16} />
                <span>Append-only immutable audit logging</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="checkCircle" size={16} />
                <span>Strict RBAC permission checks on every API request</span>
              </li>
            </ul>
          </SectionCard>
        </div>
      )}

      {/* Services Entitlements Tab */}
      {activeTab === "services" && (
        <div style={{ maxWidth: 800 }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              Enable or disable services for your workspace. Disabled services are hidden from navigation and protected from unauthorized API access.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { code: "people", name: "People Directory", desc: "Centralized database for customers, students, members, and employees." },
              { code: "crm", name: "Leads & CRM", desc: "Sales pipelines, lead tracking, follow-ups, and customer conversion." },
              { code: "finance", name: "Finance & Invoices", desc: "Billing, PDF invoices, payment collections, and expense logging." },
              { code: "payroll", name: "Payroll & Salaries", desc: "Employee compensation, monthly payroll batches, and payslip generation." },
              { code: "inventory", name: "Inventory & Stock", desc: "Product catalog, stock movement ledger, and low-stock alerts." },
            ].map((srv) => {
              const currentSrv = services.find((s) => s.code === srv.code);
              const isEnabled = currentSrv ? currentSrv.enabled : true;

              return (
                <div
                  key={srv.code}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "#fff",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    boxShadow: "var(--shadow)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div className="stat-icon blue">
                      <Icon
                        name={
                          srv.code === "people"
                            ? "people"
                            : srv.code === "crm"
                              ? "crm"
                              : srv.code === "finance"
                                ? "finance"
                                : srv.code === "payroll"
                                  ? "payroll"
                                  : "inventory"
                        }
                      />
                    </div>
                    <div>
                      <strong style={{ fontSize: 14 }}>{srv.name}</strong>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
                        {srv.desc}
                      </p>
                    </div>
                  </div>

                  <div>
                    <button
                      className={`btn btn-sm ${isEnabled ? "btn-secondary" : "btn-primary"}`}
                      onClick={() => handleToggleService(srv.code, isEnabled)}
                    >
                      <span>{isEnabled ? "Disable" : "Enable"}</span>
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
          <div className="table-wrap">
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
                        ? "Full administrative access across all modules"
                        : r.name === "Admin"
                          ? "Organisation administration and operations"
                          : r.name === "Sales"
                            ? "Access to CRM, Leads, Follow-ups and People"
                            : r.name === "Accountant"
                              ? "Access to Invoices, Payments, Expenses and Dues"
                              : r.name === "HR"
                                ? "Access to Staff records, Salaries and Payroll"
                                : "General access to Inventory and Catalog"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Audit Trail Tab */}
      {activeTab === "audit" && (
        <div className="table-wrap">
          {auditLogs.length === 0 ? (
            <EmptyState
              icon="shield"
              title="No audit events recorded"
              description="Critical business and security actions will be logged here with timestamps."
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>
                      <code>{log.action}</code>
                    </td>
                    <td>
                      <Badge tone="neutral">{log.entityType}</Badge>
                    </td>
                    <td>
                      <strong>{log.actor?.name || log.actor?.email || "System"}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </AppShell>
  );
}
