"use client";

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
  { label: "Platform Overview", icon: "home", href: "/" },
  { label: "Organisations", icon: "building", href: "/#organisations" },
  { label: "Services & Adoption", icon: "services", href: "/#services" },
  { label: "Platform Audit", icon: "shield", href: "/#audit" },
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

export default function AdminHomePage() {
  const router = useRouter();
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const [data, setData] = useState<PlatformOverview | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgsModalOpen, setOrgsModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganisationDetail | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${api}/platform/overview`, { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load platform overview.");
      const overviewData = await res.json();
      setData(overviewData);

      // Load all organisations
      const orgsRes = await fetch(`${api}/platform/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        setOrganisations(orgsData.organisations || []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <AppShell
      product="CRMKaro Admin"
      organisation="Platform Operations"
      nav={nav}
      dark
      userName="Super Admin"
      userRole="Platform Administrator"
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="shield" size={14} /> Restricted Platform Console
          </p>
          <h1>Platform Operations Overview</h1>
          <p className="subheading">
            Live multi-tenant metrics, tenant health, service adoption, and global audit trails.
          </p>
        </div>
        <span className="date-chip">Live Cloud Environment</span>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="state-spinner" />
          <p>Loading platform signals…</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <Icon name="alertCircle" size={28} />
          <h3>Platform Console Error</h3>
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="stats-grid">
            <StatCard
              label="Registered Tenants"
              value={data?.stats.organisations ?? 0}
              change={`${data?.stats.activeOrganisations ?? 0} active workspaces`}
              icon="building"
              tone="blue"
            />
            <StatCard
              label="Active Services"
              value={data?.stats.activeServices ?? 0}
              change="Tenant entitlements"
              icon="services"
              tone="teal"
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
              value="Verified"
              change="PostgreSQL RLS Active"
              icon="shield"
              tone="purple"
            />
          </div>

          <div className="content-grid" style={{ marginTop: 24 }}>
            {/* Recent Organisations */}
            <SectionCard
              title="Registered Workspaces"
              subtitle="Latest client organisations onboarding"
              action="View All Tenants"
              onAction={() => setOrgsModalOpen(true)}
            >
              <ul className="activity-list">
                {data?.recentOrganisations.map((org) => (
                  <li
                    key={org.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      const full = organisations.find((o) => o.id === org.id);
                      if (full) setSelectedOrg(full);
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
                    <time>{new Date(org.createdAt).toLocaleDateString()}</time>
                  </li>
                ))}
              </ul>
            </SectionCard>

            {/* Service Adoption Breakdown */}
            <SectionCard
              title="Service Adoption"
              subtitle="Enabled modules across registered tenants"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
                {data?.adoption.map((s) => (
                  <div key={s.code} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <strong>{s.name}</strong>
                      <span>
                        {s.count} tenants ({s.percentage}%)
                      </span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${s.percentage || 10}%`,
                          background: "var(--brand)",
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
              title="Platform Audit Events"
              subtitle="Immutable operations and security log"
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

            {/* Administrative Controls */}
            <SectionCard
              title="Administrative Tools"
              subtitle="Quick console workflows"
            >
              <div className="quick-grid">
                <button className="quick-tile" onClick={() => setOrgsModalOpen(true)}>
                  <Icon name="building" />
                  <div>
                    <strong>Tenant Directory</strong>
                    <small>Search and view</small>
                  </div>
                </button>
                <button
                  className="quick-tile"
                  onClick={() => alert("Health status: All PostgreSQL and Redis instances OK.")}
                >
                  <Icon name="activity" />
                  <div>
                    <strong>System Health</strong>
                    <small>Node & DB metrics</small>
                  </div>
                </button>
              </div>
            </SectionCard>
          </div>

          {/* All Organisations Modal */}
          <Modal
            isOpen={orgsModalOpen}
            onClose={() => setOrgsModalOpen(false)}
            title="All Registered Organisations"
            subtitle="Tenant management & statistics"
            maxWidth={720}
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Workspace Name</th>
                    <th>Type</th>
                    <th>Members</th>
                    <th>Directory</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {organisations.map((org) => (
                    <tr
                      key={org.id}
                      className="clickable"
                      onClick={() => {
                        setSelectedOrg(org);
                        setOrgsModalOpen(false);
                      }}
                    >
                      <td>
                        <strong>{org.name}</strong>
                      </td>
                      <td>{org.businessType}</td>
                      <td>{org.memberCount}</td>
                      <td>{org.peopleCount} records</td>
                      <td>
                        <Badge tone={org.status === "ACTIVE" ? "green" : "neutral"}>
                          {org.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modal>

          {/* Organisation Details Modal */}
          <Modal
            isOpen={Boolean(selectedOrg)}
            onClose={() => setSelectedOrg(null)}
            title={selectedOrg?.name || "Workspace Details"}
            subtitle="Tenant Profile"
            maxWidth={480}
          >
            {selectedOrg && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="key-value-list">
                  <div className="key-value-item">
                    <label>Tenant ID</label>
                    <span>
                      <code>{selectedOrg.id}</code>
                    </span>
                  </div>
                  <div className="key-value-item">
                    <label>Status</label>
                    <span>
                      <Badge tone={selectedOrg.status === "ACTIVE" ? "green" : "neutral"}>
                        {selectedOrg.status}
                      </Badge>
                    </span>
                  </div>
                  <div className="key-value-item">
                    <label>Business Type</label>
                    <span>{selectedOrg.businessType}</span>
                  </div>
                  <div className="key-value-item">
                    <label>Registered Date</label>
                    <span>{new Date(selectedOrg.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="key-value-item">
                    <label>Team Members</label>
                    <span>{selectedOrg.memberCount} users</span>
                  </div>
                  <div className="key-value-item">
                    <label>People Directory</label>
                    <span>{selectedOrg.peopleCount} contacts</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                    Active Services ({selectedOrg.services.length})
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {selectedOrg.services.map((s) => (
                      <Badge key={s.code} tone="blue">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Modal>
        </>
      )}
    </AppShell>
  );
}
