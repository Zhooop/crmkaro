"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

export type IconName =
  | "home"
  | "people"
  | "crm"
  | "finance"
  | "payroll"
  | "inventory"
  | "reports"
  | "settings"
  | "search"
  | "bell"
  | "plus"
  | "arrow"
  | "building"
  | "services"
  | "activity"
  | "shield"
  | "menu"
  | "close";

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    people: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    crm: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M4 9h16M9 9v11" />
      </>
    ),
    finance: (
      <>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    payroll: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h4M7 13h2M15 9h2M15 13h2" />
      </>
    ),
    inventory: (
      <>
        <path d="m21 8-9-5-9 5 9 5 9-5Z" />
        <path d="m3 8 9 5 9-5M3 8v8l9 5 9-5V8M12 13v8" />
      </>
    ),
    reports: (
      <>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.01A1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.01A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m9 18 6-6-6-6" />,
    building: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <path d="M8 7h2M14 7h2M8 11h2M14 11h2M9 21v-5h6v5" />
      </>
    ),
    services: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export type NavItem = {
  label: string;
  icon: IconName;
  badge?: string;
  href?: string;
};
export function AppShell({
  product,
  organisation,
  nav,
  children,
  dark = false,
  userName = "Workspace user",
  userRole = "Member",
  notificationCount = 0,
}: {
  product: string;
  organisation: string;
  nav: NavItem[];
  children: ReactNode;
  dark?: boolean;
  userName?: string;
  userRole?: string;
  notificationCount?: number;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return (
    <div className={`app-shell${dark ? " admin-theme" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {open && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar${open ? " is-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">C</div>
          <div>
            <strong>{product}</strong>
            <span>{dark ? "Platform console" : "Business workspace"}</span>
          </div>
          <button
            className="icon-button mobile-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <Icon name="close" />
          </button>
        </div>
        <button className="organisation-switcher">
          <span className="organisation-avatar">
            {organisation.slice(0, 2).toUpperCase()}
          </span>
          <span>
            <small>Organisation</small>
            <strong>{organisation}</strong>
          </span>
          <Icon name="arrow" size={15} />
        </button>
        <nav aria-label="Main navigation">
          {nav.map((item, index) => (
            <a
              className={index === 0 ? "nav-link active" : "nav-link"}
              aria-current={index === 0 ? "page" : undefined}
              href={item.href ?? "#"}
              key={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.badge && <em>{item.badge}</em>}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar">
            {userName
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <strong>{userName}</strong>
            <span>{dark ? "Super administrator" : userRole}</span>
          </div>
          <button className="icon-button" aria-label="User settings">
            <Icon name="settings" size={17} />
          </button>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>
          <button className="global-search">
            <Icon name="search" />
            <span>Search anything…</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="topbar-actions">
            <button
              className="icon-button notification-button"
              aria-label={`${notificationCount} notifications`}
            >
              <Icon name="bell" />
              {notificationCount > 0 && <i />}
            </button>
            <button className="primary-button">
              <Icon name="plus" size={17} />
              <span>Quick add</span>
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
      </section>
    </div>
  );
}

export function StatCard({
  label,
  value,
  change,
  tone = "blue",
  icon,
}: {
  label: string;
  value: string;
  change: string;
  tone?: string;
  icon: IconName;
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <Icon name={icon} />
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{change}</small>
      </div>
      <button aria-label={`View ${label}`}>
        <Icon name="arrow" size={16} />
      </button>
    </article>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && (
          <button className="text-button">
            {action}
            <Icon name="arrow" size={15} />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

export function AuthPanel({
  admin = false,
  apiUrl = "http://localhost:4000/api/v1",
  onAuthenticated,
}: {
  admin?: boolean;
  apiUrl?: string;
  onAuthenticated?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (admin) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `${apiUrl}/auth/email/${challengeId ? "verify-otp" : "request-otp"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(challengeId ? { challengeId, code } : { email }),
        },
      );
      const body = (await response.json()) as {
        challengeId?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(body.message ?? "Sign in failed.");
      if (body.challengeId) {
        setChallengeId(body.challengeId);
        setMessage("A six-digit code was sent to your email.");
      } else onAuthenticated?.();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={`auth-page${admin ? " admin-auth" : ""}`}>
      <section className="auth-story">
        <div className="brand-row">
          <div className="brand-mark">C</div>
          <div>
            <strong>{admin ? "CRMKaro Admin" : "CRMKaro"}</strong>
            <span>
              {admin
                ? "Restricted platform console"
                : "Business, clearly organised"}
            </span>
          </div>
        </div>
        <div>
          <p className="eyebrow">
            <Icon name={admin ? "shield" : "activity"} size={14} />
            {admin ? "Authorised personnel only" : "One calm workspace"}
          </p>
          <h1>
            {admin
              ? "Operate the platform securely."
              : "Run your whole business with clarity."}
          </h1>
          <p>
            {admin
              ? "Platform access is isolated from client workspaces and every administrative action is audited."
              : "CRM, people, finance, payroll and inventory—connected without the clutter."}
          </p>
        </div>
        <small>Secure sessions · Tenant isolation · Audit logging</small>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <h2>{admin ? "Admin sign in" : "Welcome back"}</h2>
          <p>
            {admin
              ? "Use your authorised platform account."
              : "Sign in to continue to your workspace."}
          </p>
          {!admin && (
            <a className="google-button" href={`${apiUrl}/auth/google/start`}>
              <span>G</span>Continue with Google
            </a>
          )}
          <div className="auth-divider">
            <span>or use email</span>
          </div>
          <label htmlFor={challengeId ? "code" : "email"}>
            {challengeId ? "Secure login code" : "Work email"}
          </label>
          {challengeId ? (
            <input
              id="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="000000"
              autoComplete="one-time-code"
              required
            />
          ) : (
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          )}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy
              ? "Please wait…"
              : challengeId
                ? "Verify and continue"
                : "Send secure login code"}
          </button>
          {challengeId && (
            <button
              className="auth-back"
              type="button"
              onClick={() => {
                setChallengeId("");
                setCode("");
                setMessage("");
              }}
            >
              Use a different email
            </button>
          )}
          {message && (
            <p className="auth-message" role="status">
              {message}
            </p>
          )}
          <p className="auth-note">
            <Icon name="shield" size={14} />
            We’ll use a secure, short-lived session.
          </p>
        </form>
      </section>
    </main>
  );
}
