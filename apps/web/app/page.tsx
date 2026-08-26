"use client";

import {
  AppShell,
  Icon,
  SectionCard,
  StatCard,
  type IconName,
  type NavItem,
} from "@crmkaro/ui";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Dashboard = {
  organisation: { name: string; currency: string; timezone: string };
  user: { name: string | null; email: string };
  role: { name: string; code: string } | null;
  services: string[];
  cards: Array<{
    key: string;
    label: string;
    value: number;
    detail: string;
    format: "number" | "money";
  }>;
  notifications: Array<{
    id: string;
    module: string;
    title: string;
    detail: string;
    severity: string;
  }>;
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
  }>;
  generatedAt: string;
};

const icons: Record<string, IconName> = {
  people: "people",
  crm: "crm",
  finance: "finance",
  payroll: "payroll",
  inventory: "inventory",
};
const serviceNav: Record<string, NavItem> = {
  people: { label: "People", icon: "people", href: "/people" },
  crm: { label: "Leads & CRM", icon: "crm", href: "/crm" },
  finance: { label: "Finance", icon: "finance", href: "/finance" },
  payroll: { label: "Payroll", icon: "payroll", href: "/payroll" },
  inventory: { label: "Inventory", icon: "inventory", href: "/inventory" },
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
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

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const api =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
    fetch(`${api}/dashboard`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!response.ok)
          throw new Error("Your dashboard could not be loaded.");
        return response.json() as Promise<Dashboard>;
      })
      .then((dashboard) => dashboard && setData(dashboard))
      .catch((reason: Error) => setError(reason.message));
  }, [router]);
  if (error)
    return (
      <main className="dashboard-state">
        <Icon name="activity" size={32} />
        <h1>Dashboard unavailable</h1>
        <p>{error}</p>
        <button
          className="primary-button"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </main>
    );
  if (!data) return <DashboardLoading />;
  const nav: NavItem[] = [
    { label: "Overview", icon: "home", href: "/" },
    ...data.services
      .map((service) => serviceNav[service])
      .filter((item): item is NavItem => Boolean(item)),
    { label: "Reports", icon: "reports", href: "/reports" },
    { label: "Settings", icon: "settings", href: "/settings" },
  ];
  const displayName =
    data.user.name ?? data.user.email.split("@")[0] ?? "there";
  return (
    <AppShell
      product="CRMKaro"
      organisation={data.organisation.name}
      nav={nav}
      userName={displayName}
      userRole={data.role?.name ?? "Member"}
      notificationCount={data.notifications.length}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="activity" size={14} />
            Live business overview
          </p>
          <h1>Welcome back, {displayName}</h1>
          <p className="subheading">
            Only the modules and data available to your role are shown here.
          </p>
        </div>
        <span className="date-chip">Updated just now</span>
      </div>
      <div className="stats-grid">
        {data.cards.map((card, index) => (
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
            tone={["blue", "teal", "amber", "rose"][index % 4]}
          />
        ))}
      </div>
      <div className="content-grid">
        <SectionCard
          title="Recent activity"
          subtitle="Audited updates visible to your role"
        >
          <ul className="activity-list">
            {data.activity.length ? (
              data.activity.map((item) => (
                <li key={item.id}>
                  <span className="activity-dot">
                    <Icon name={icons[item.entityType] ?? "activity"} />
                  </span>
                  <span className="activity-copy">
                    <strong>{item.action.split(".").join(" ")}</strong>
                    <span>{item.entityType.replaceAll("_", " ")}</span>
                  </span>
                  <time>
                    {new Intl.RelativeTimeFormat("en", {
                      numeric: "auto",
                    }).format(
                      Math.round(
                        (new Date(item.createdAt).getTime() -
                          new Date(data.generatedAt).getTime()) /
                          60000,
                      ),
                      "minute",
                    )}
                  </time>
                </li>
              ))
            ) : (
              <li className="empty-row">
                <span className="activity-copy">
                  <strong>No recent activity</strong>
                  <span>New workspace events will appear here.</span>
                </span>
              </li>
            )}
          </ul>
        </SectionCard>
        <SectionCard
          title="Notifications"
          subtitle="Prioritised operational signals"
        >
          <ul className="activity-list">
            {data.notifications.length ? (
              data.notifications.map((item) => (
                <li key={item.id}>
                  <span className={`activity-dot severity-${item.severity}`}>
                    <Icon name={icons[item.module] ?? "bell"} />
                  </span>
                  <span className="activity-copy">
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </span>
                  <time>{item.module}</time>
                </li>
              ))
            ) : (
              <li className="empty-row">
                <span className="activity-copy">
                  <strong>You’re all caught up</strong>
                  <span>No operational alerts need attention.</span>
                </span>
              </li>
            )}
          </ul>
        </SectionCard>
        <SectionCard
          title="Quick actions"
          subtitle="Available services in this workspace"
        >
          <div className="quick-grid">
            {data.services.slice(0, 6).map((service) => (
              <a
                className="quick-tile"
                href={serviceNav[service]?.href ?? "#"}
                key={service}
              >
                <Icon name={icons[service] ?? "services"} />
                {serviceNav[service]?.label ?? service}
              </a>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Access context" subtitle="Current session scope">
          <div className="access-summary">
            <span>
              <small>Role</small>
              <strong>{data.role?.name ?? "Member"}</strong>
            </span>
            <span>
              <small>Enabled modules</small>
              <strong>{data.services.length}</strong>
            </span>
            <span>
              <small>Data boundary</small>
              <strong>Organisation only</strong>
            </span>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
