"use client";

import {
  AppShell,
  Icon,
  SectionCard,
  StatCard,
  type IconName,
  type NavItem,
} from "@crmkaro/ui";
import { type FormEvent, useCallback, useEffect, useState } from "react";
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

type OrganisationEntry = {
  organisation: { id: string; name: string } | null;
};

const availableServices = [
  {
    code: "people",
    label: "People",
    detail: "Students, members and employees",
  },
  {
    code: "crm",
    label: "Leads & CRM",
    detail: "Pipeline, leads and follow-ups",
  },
  {
    code: "finance",
    label: "Finance",
    detail: "Payments, invoices and expenses",
  },
  { code: "payroll", label: "Payroll", detail: "Salaries, runs and payslips" },
  {
    code: "inventory",
    label: "Inventory",
    detail: "Products, stock and movements",
  },
] as const;

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
  const [needsSetup, setNeedsSetup] = useState(false);
  const [organisationName, setOrganisationName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>(
    availableServices.map(({ code }) => code),
  );
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState("");

  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const loadDashboard = useCallback(async () => {
    const response = await fetch(`${api}/dashboard`, {
      credentials: "include",
    });
    if (response.status === 401) {
      router.replace("/login");
      return;
    }
    if (response.status === 403) {
      const organisationsResponse = await fetch(`${api}/organisations`, {
        credentials: "include",
      });
      if (organisationsResponse.status === 401) {
        router.replace("/login");
        return;
      }
      if (!organisationsResponse.ok)
        throw new Error("Your workspace could not be loaded.");
      const organisations =
        (await organisationsResponse.json()) as OrganisationEntry[];
      const firstOrganisation = organisations.find(
        ({ organisation }) => organisation,
      )?.organisation;
      if (!firstOrganisation) {
        setNeedsSetup(true);
        return;
      }
      const activationResponse = await fetch(
        `${api}/organisations/${firstOrganisation.id}/activate`,
        { method: "POST", credentials: "include" },
      );
      if (!activationResponse.ok)
        throw new Error("Your workspace could not be activated.");
      const activatedDashboardResponse = await fetch(`${api}/dashboard`, {
        credentials: "include",
      });
      if (!activatedDashboardResponse.ok)
        throw new Error("Your dashboard could not be loaded.");
      setData((await activatedDashboardResponse.json()) as Dashboard);
      return;
    }
    if (!response.ok) throw new Error("Your dashboard could not be loaded.");
    setData((await response.json()) as Dashboard);
  }, [api, router]);

  useEffect(() => {
    // Initial client-side session resolution intentionally updates page state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard().catch((reason: Error) => setError(reason.message));
  }, [loadDashboard]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSetupBusy(true);
    setSetupError("");
    try {
      const response = await fetch(`${api}/organisations`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: organisationName,
          businessType: businessType || undefined,
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
              Create a private workspace. You can invite your team and adjust
              modules later.
            </p>
          </div>
          <form className="onboarding-form" onSubmit={createWorkspace}>
            <label htmlFor="organisation-name">
              Business or workspace name
            </label>
            <input
              id="organisation-name"
              value={organisationName}
              onChange={(event) => setOrganisationName(event.target.value)}
              minLength={2}
              maxLength={180}
              placeholder="Example: Sunrise Academy"
              autoFocus
              required
            />
            <label htmlFor="business-type">Business type (optional)</label>
            <input
              id="business-type"
              value={businessType}
              onChange={(event) => setBusinessType(event.target.value)}
              maxLength={80}
              placeholder="Example: Coaching institute"
            />
            <fieldset>
              <legend>Start with these modules</legend>
              <div className="onboarding-modules">
                {availableServices.map((service) => {
                  const selected = selectedServices.includes(service.code);
                  return (
                    <label
                      className={`module-choice${selected ? " selected" : ""}`}
                      key={service.code}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setSelectedServices((current) =>
                            selected
                              ? current.filter((code) => code !== service.code)
                              : [...current, service.code],
                          )
                        }
                      />
                      <span>
                        <strong>{service.label}</strong>
                        <small>{service.detail}</small>
                      </span>
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
                selectedServices.length === 0
              }
            >
              {setupBusy ? "Creating workspace…" : "Create my workspace"}
            </button>
            {setupError && (
              <p className="onboarding-error" role="alert">
                {setupError}
              </p>
            )}
            <small className="onboarding-security">
              Your workspace data is isolated from every other organisation.
            </small>
          </form>
        </section>
      </main>
    );
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
