"use client";

export const dynamic = "force-dynamic";

import {
  AppShell,
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
  organisation: { name: string; currency: string; timezone: string };
  user: { name: string | null; email: string; isNewUser?: boolean };
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
    severity: "info" | "warning" | "critical";
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
  organisation: { id: string; name: string; businessType?: string; activeServices?: string[] } | null;
  role?: { name: string; code?: string };
  activeServices?: string[];
};

const icons: Record<string, IconName> = {
  students: "student",
  people: "people",
  crm: "crm",
  finance: "finance",
  payroll: "payroll",
  inventory: "inventory",
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
  // All services deselected by default as requested
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
              onChange={(event) => setOrganisationName(event.target.value)}
              minLength={2}
              maxLength={180}
              placeholder="Example: Sunrise Academy"
              required
              autoFocus
            />

            <label htmlFor="business-type">
              Primary Business Category <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="business-type"
              value={selectedBusinessType}
              onChange={(event) => setSelectedBusinessType(event.target.value)}
              required
            >
              <option value="" disabled>
                -- Select your business type --
              </option>
              {BUSINESS_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {selectedBusinessType === "Other" && (
              <div className="onboarding-custom-field">
                <label htmlFor="custom-business-type">
                  Specify your business type <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="custom-business-type"
                  value={customBusinessType}
                  onChange={(event) => setCustomBusinessType(event.target.value)}
                  maxLength={80}
                  placeholder="e.g. Photography Studio, Event Decor, Solar Solutions…"
                  required
                  autoFocus
                />
              </div>
            )}

            <fieldset>
              <legend>Select Optional Business Modules</legend>
              <div className="onboarding-modules">
                {ALL_AVAILABLE_SERVICES.map((service) => {
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
                !selectedBusinessType
              }
              type="submit"
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

  return (
    <AppShell
      currentPath="/"
      nav={nav}
      organisation={data.organisation.name}
      organisations={organisations}
      product="CRMKaro"
      userName={displayName}
      userRole={data.role?.name ?? "Administrator"}
      notifications={data.notifications}
      apiUrl={api}
      onSwitchOrganisation={handleSwitchOrg}
      onNavigate={(href) => router.push(href)}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="activity" size={14} />
            Live business overview
          </p>
          <h1>{data.user?.isNewUser ? `Welcome, ${displayName}` : `Welcome back, ${displayName}`}</h1>
          <p className="subheading">
            Only the active modules and data for your organization are shown here.
          </p>
        </div>
        <span className="date-chip">Updated just now</span>
      </div>

      {/* Live Stat Cards */}
      <div className="stats-grid">
        {data.cards.map((card, index) => {
          const targetHref = SERVICE_NAV_MAP[card.key]?.href;
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
              tone={["blue", "teal", "amber", "rose", "purple"][index % 5] as any}
              onClick={targetHref ? () => router.push(targetHref) : undefined}
            />
          );
        })}
      </div>

      <div className="content-grid">
        <SectionCard
          title="Recent activity"
          subtitle="Audited updates in this workspace"
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
          subtitle="Available active services in this workspace"
        >
          <div className="quick-grid">
            {data.services.slice(0, 6).map((service) => (
              <a
                className="quick-tile"
                href={SERVICE_NAV_MAP[service]?.href ?? "#"}
                key={service}
              >
                <Icon name={icons[service] ?? "services"} />
                <div>
                  <strong>{SERVICE_NAV_MAP[service]?.label ?? service}</strong>
                  <small>Open module</small>
                </div>
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
              <small>Active modules</small>
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
