"use client";

import {
  useEffect,
  useState,
  useRef,
  type FormEvent,
  type ReactNode,
  useCallback,
} from "react";

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
  | "close"
  | "edit"
  | "trash"
  | "download"
  | "upload"
  | "filter"
  | "check"
  | "x"
  | "chevronDown"
  | "chevronRight"
  | "chevronLeft"
  | "eye"
  | "refresh"
  | "copy"
  | "dollar"
  | "user"
  | "tag"
  | "mail"
  | "phone"
  | "calendar"
  | "clock"
  | "alertCircle"
  | "checkCircle"
  | "logout"
  | "externalLink"
  | "kanban"
  | "list"
  | "moreVertical";

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
    edit: (
      <>
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </>
    ),
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      </>
    ),
    filter: (
      <>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </>
    ),
    check: <polyline points="20 6 9 17 4 12" />,
    x: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    chevronDown: <polyline points="6 9 12 15 18 9" />,
    chevronRight: <polyline points="9 18 15 12 9 6" />,
    chevronLeft: <polyline points="15 18 9 12 15 6" />,
    eye: (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    refresh: (
      <>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 21h5v-5" />
      </>
    ),
    copy: (
      <>
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </>
    ),
    dollar: (
      <>
        <line x1="12" x2="12" y1="2" y2="22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    user: (
      <>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    tag: (
      <>
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
        <path d="M7 7h.01" />
      </>
    ),
    mail: (
      <>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </>
    ),
    phone: (
      <>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </>
    ),
    calendar: (
      <>
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    alertCircle: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </>
    ),
    checkCircle: (
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" x2="9" y1="12" y2="12" />
      </>
    ),
    externalLink: (
      <>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" x2="21" y1="14" y2="3" />
      </>
    ),
    kanban: (
      <>
        <rect width="6" height="14" x="3" y="5" rx="1" />
        <rect width="6" height="10" x="11" y="5" rx="1" />
        <rect width="6" height="16" x="19" y="5" rx="1" />
      </>
    ),
    list: (
      <>
        <line x1="8" x2="21" y1="6" y2="6" />
        <line x1="8" x2="21" y1="12" y2="12" />
        <line x1="8" x2="21" y1="18" y2="18" />
        <line x1="3" x2="3.01" y1="6" y2="6" />
        <line x1="3" x2="3.01" y1="12" y2="12" />
        <line x1="3" x2="3.01" y1="18" y2="18" />
      </>
    ),
    moreVertical: (
      <>
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
      </>
    ),
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
      {paths[name] || paths.home}
    </svg>
  );
}

export type NavItem = {
  label: string;
  icon: IconName;
  badge?: string;
  href?: string;
};

export type OrganisationSummary = {
  id: string;
  name: string;
  slug?: string;
  businessType?: string;
};

export type NotificationItem = {
  id: string;
  module: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  url?: string;
};

export type SearchResult = {
  id: string;
  type: "person" | "lead" | "invoice" | "product";
  title: string;
  subtitle: string;
  badge?: string;
  url: string;
};

export function AppShell({
  product,
  organisation,
  organisations = [],
  currentPath = "/",
  nav,
  children,
  dark = false,
  userName = "Workspace user",
  userEmail = "",
  userRole = "Member",
  notifications = [],
  apiUrl = "http://localhost:4000/api/v1",
  onSwitchOrganisation,
  onCreateOrganisation,
  onLogout,
}: {
  product: string;
  organisation: string;
  organisations?: OrganisationSummary[];
  currentPath?: string;
  nav: NavItem[];
  children: ReactNode;
  dark?: boolean;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  notifications?: NotificationItem[];
  apiUrl?: string;
  onSwitchOrganisation?: (orgId: string) => void;
  onCreateOrganisation?: () => void;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Keyboard shortcut ⌘K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setSearchOpen(false);
        setQuickAddOpen(false);
        setNotificationsOpen(false);
        setOrgSwitcherOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search query
  useEffect(() => {
    if (!searchOpen || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `${apiUrl}/search?q=${encodeURIComponent(searchQuery)}`,
          { credentials: "include" },
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen, apiUrl]);

  async function handleLogoutClick() {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  const notificationCount = notifications.length;

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
          <div className="brand-mark">
            <img src="/brand/crmkaro-mark.png" alt="CRMKaro Logo" />
          </div>
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

        {/* Organisation Switcher */}
        <div style={{ position: "relative" }}>
          <button
            className="organisation-switcher"
            onClick={() => setOrgSwitcherOpen(!orgSwitcherOpen)}
            aria-expanded={orgSwitcherOpen}
          >
            <span className="organisation-avatar">
              {organisation ? organisation.slice(0, 2).toUpperCase() : "CK"}
            </span>
            <span>
              <small>Organisation</small>
              <strong>{organisation || "Select workspace"}</strong>
            </span>
            <Icon name="chevronDown" size={15} />
          </button>

          {orgSwitcherOpen && (
            <div className="org-switcher-dropdown">
              <div className="org-dropdown-header">Workspaces</div>
              <div className="org-dropdown-list">
                {organisations.map((org) => (
                  <button
                    key={org.id}
                    className={`org-dropdown-item${org.name === organisation ? " active" : ""}`}
                    onClick={() => {
                      setOrgSwitcherOpen(false);
                      onSwitchOrganisation?.(org.id);
                    }}
                  >
                    <span className="org-item-avatar">
                      {org.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="org-item-info">
                      <strong>{org.name}</strong>
                      <small>{org.businessType || "Workspace"}</small>
                    </div>
                    {org.name === organisation && (
                      <Icon name="check" size={15} />
                    )}
                  </button>
                ))}
              </div>
              {onCreateOrganisation && (
                <div className="org-dropdown-footer">
                  <button
                    className="org-create-btn"
                    onClick={() => {
                      setOrgSwitcherOpen(false);
                      onCreateOrganisation();
                    }}
                  >
                    <Icon name="plus" size={15} />
                    <span>Create new workspace</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <nav aria-label="Main navigation">
          {nav.map((item) => {
            const isActive =
              currentPath === item.href ||
              (item.href !== "/" && currentPath?.startsWith(item.href ?? ""));
            return (
              <a
                className={isActive ? "nav-link active" : "nav-link"}
                aria-current={isActive ? "page" : undefined}
                href={item.href ?? "#"}
                key={item.label}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.badge && <em>{item.badge}</em>}
              </a>
            );
          })}
        </nav>

        {/* User profile & settings footer */}
        <div style={{ position: "relative" }}>
          <div
            className="sidebar-footer"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{ cursor: "pointer" }}
          >
            <div className="user-avatar">
              {(userName || "User")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <strong>{userName || "User"}</strong>
              <span>{dark ? "Super administrator" : userRole}</span>
            </div>
            <button
              className="icon-button"
              aria-label="User settings"
              onClick={(e) => {
                e.stopPropagation();
                setUserMenuOpen(!userMenuOpen);
              }}
            >
              <Icon name="settings" size={17} />
            </button>
          </div>

          {userMenuOpen && (
            <div className="user-dropdown-menu">
              <div className="user-dropdown-header">
                <strong>{userName}</strong>
                {userEmail && <small>{userEmail}</small>}
                <span className="badge badge-neutral" style={{ marginTop: 4 }}>
                  {userRole}
                </span>
              </div>
              <div className="user-dropdown-divider" />
              <a
                href="/settings"
                className="user-dropdown-link"
                onClick={() => setUserMenuOpen(false)}
              >
                <Icon name="settings" size={16} />
                <span>Settings & Access</span>
              </a>
              <button
                className="user-dropdown-link danger"
                onClick={handleLogoutClick}
              >
                <Icon name="logout" size={16} />
                <span>Log out</span>
              </button>
            </div>
          )}
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
          <button
            className="global-search"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Icon name="search" />
            <span>Search anything…</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="topbar-actions">
            <button
              className="icon-button notification-button"
              aria-label={`${notificationCount} notifications`}
              onClick={() => setNotificationsOpen(true)}
            >
              <Icon name="bell" />
              {notificationCount > 0 && <i />}
            </button>
            <button
              className="primary-button"
              onClick={() => setQuickAddOpen(true)}
            >
              <Icon name="plus" size={17} />
              <span>Quick add</span>
            </button>
          </div>
        </header>

        <main id="main-content" className="main-content">
          {children}
        </main>
      </section>

      {/* Global Search Command Palette */}
      {searchOpen && (
        <div className="modal-overlay" onClick={() => setSearchOpen(false)}>
          <div
            className="command-palette"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="palette-input-wrap">
              <Icon name="search" size={20} />
              <input
                type="text"
                placeholder="Search people, leads, invoices, products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button
                className="icon-button"
                onClick={() => setSearchOpen(false)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="palette-results">
              {searchLoading ? (
                <div className="palette-empty">Searching records…</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <a
                    key={`${item.type}-${item.id}`}
                    href={item.url}
                    className="palette-item"
                    onClick={() => setSearchOpen(false)}
                  >
                    <div className="palette-item-icon">
                      <Icon
                        name={
                          item.type === "person"
                            ? "people"
                            : item.type === "lead"
                              ? "crm"
                              : item.type === "invoice"
                                ? "finance"
                                : "inventory"
                        }
                        size={18}
                      />
                    </div>
                    <div className="palette-item-content">
                      <div className="palette-item-title">
                        <strong>{item.title}</strong>
                        {item.badge && (
                          <span className="badge badge-neutral">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <small>{item.subtitle}</small>
                    </div>
                    <Icon name="chevronRight" size={16} />
                  </a>
                ))
              ) : searchQuery.trim() ? (
                <div className="palette-empty">
                  No matching records found for "{searchQuery}".
                </div>
              ) : (
                <div className="palette-empty">
                  Type to instantly search across all business modules.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Modal */}
      {quickAddOpen && (
        <div className="modal-overlay" onClick={() => setQuickAddOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Quick Add</h2>
                <p>Create a new record in one click</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setQuickAddOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="quick-add-grid">
              <a
                href="/people?action=new"
                className="quick-tile"
                onClick={() => setQuickAddOpen(false)}
              >
                <div className="stat-icon teal">
                  <Icon name="people" />
                </div>
                <div>
                  <strong>Add Person</strong>
                  <small>Customer, student, member</small>
                </div>
              </a>
              <a
                href="/crm?action=new"
                className="quick-tile"
                onClick={() => setQuickAddOpen(false)}
              >
                <div className="stat-icon blue">
                  <Icon name="crm" />
                </div>
                <div>
                  <strong>Create Lead</strong>
                  <small>Add to sales pipeline</small>
                </div>
              </a>
              <a
                href="/finance?action=new-invoice"
                className="quick-tile"
                onClick={() => setQuickAddOpen(false)}
              >
                <div className="stat-icon amber">
                  <Icon name="finance" />
                </div>
                <div>
                  <strong>New Invoice</strong>
                  <small>Bill client or customer</small>
                </div>
              </a>
              <a
                href="/finance?action=new-expense"
                className="quick-tile"
                onClick={() => setQuickAddOpen(false)}
              >
                <div className="stat-icon rose">
                  <Icon name="dollar" />
                </div>
                <div>
                  <strong>Record Expense</strong>
                  <small>Operational outflow</small>
                </div>
              </a>
              <a
                href="/inventory?action=new-product"
                className="quick-tile"
                onClick={() => setQuickAddOpen(false)}
              >
                <div className="stat-icon teal">
                  <Icon name="inventory" />
                </div>
                <div>
                  <strong>Add Product</strong>
                  <small>Catalog item or service</small>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Drawer */}
      {notificationsOpen && (
        <div
          className="drawer-overlay"
          onClick={() => setNotificationsOpen(false)}
        >
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2>Notifications</h2>
                <p>Important business alerts & reminders</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setNotificationsOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="drawer-body">
              {notifications.length === 0 ? (
                <div className="empty-state">
                  <Icon name="checkCircle" size={32} />
                  <h3>All caught up!</h3>
                  <p>No pending alerts or overdue tasks right now.</p>
                </div>
              ) : (
                <ul className="notification-list">
                  {notifications.map((n) => (
                    <li key={n.id} className={`notification-card ${n.severity}`}>
                      <div className="notification-icon">
                        <Icon
                          name={
                            n.module === "crm"
                              ? "crm"
                              : n.module === "finance"
                                ? "finance"
                                : "bell"
                          }
                        />
                      </div>
                      <div className="notification-content">
                        <strong>{n.title}</strong>
                        <p>{n.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  change,
  tone = "blue",
  icon,
  onClick,
}: {
  label: string;
  value: string | number;
  change?: string;
  tone?: "blue" | "teal" | "amber" | "rose" | "purple" | string;
  icon: IconName;
  onClick?: () => void;
}) {
  return (
    <article
      className="stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className={`stat-icon ${tone}`}>
        <Icon name={icon} />
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {change && <small>{change}</small>}
      </div>
      {onClick && (
        <button aria-label={`View ${label}`}>
          <Icon name="arrow" size={16} />
        </button>
      )}
    </article>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  onAction,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
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
          <button className="text-button" onClick={onAction}>
            {action}
            <Icon name="arrow" size={15} />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "green" | "amber" | "red" | "blue" | "purple" | "neutral";
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tab-list" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={active === item.id}
          className={`tab-item${active === item.id ? " active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          <span>{item.label}</span>
          {item.count !== undefined && <em>{item.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 520,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 460,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className="drawer-panel"
        style={{ width, maxWidth: "100vw" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="drawer-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "activity",
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon name={icon} size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button className="primary-button" onClick={onAction}>
          <Icon name="plus" size={16} />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}

export function AuthPanel({
  admin = false,
  apiUrl,
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

  const resolvedApiUrl =
    apiUrl ||
    (typeof window !== "undefined" &&
    (window.location.hostname === "crmkaro.com" ||
      window.location.hostname.endsWith(".crmkaro.com"))
      ? "https://api.crmkaro.com/api/v1"
      : "http://localhost:4000/api/v1");

  const returnUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : admin
        ? "https://admin.crmkaro.com"
        : "https://crmkaro.com";

  const googleStartUrl = `${resolvedApiUrl}/auth/google/start?returnTo=${encodeURIComponent(returnUrl)}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `${resolvedApiUrl}/auth/email/${challengeId ? "verify-otp" : "request-otp"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            challengeId ? { challengeId, code } : { email },
          ),
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
      } else {
        onAuthenticated?.();
      }
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
          <div className="brand-mark">
            <img src="/brand/crmkaro-mark.png" alt="CRMKaro Logo" />
          </div>
          <div>
            <strong>{admin ? "CRMKaro Admin" : "CRMKaro"}</strong>
            <span>
              {admin
                ? "Restricted Platform Operations Console"
                : "Business Operating System"}
            </span>
          </div>
        </div>

        <div className="auth-story-body">
          <p className="eyebrow">
            <Icon name={admin ? "shield" : "activity"} size={14} />
            {admin ? "Authorised Personnel Only" : "One Unified Workspace"}
          </p>
          <h1>
            {admin
              ? "Operate the platform securely."
              : "Run your entire business with clarity."}
          </h1>
          <p>
            {admin
              ? "Platform access is strictly isolated with PostgreSQL Row-Level Security, multi-tenant monitoring, and immutable audit trails."
              : "CRM pipelines, people directory, GST invoices, automated payroll, and inventory stock—all unified without the clutter."}
          </p>

          <div className="auth-security-badges">
            <span className="security-chip">
              <Icon name="shield" size={13} />
              <span>{admin ? "RLS Tenant Isolation" : "PostgreSQL Isolated"}</span>
            </span>
            <span className="security-chip">
              <Icon name="checkCircle" size={13} />
              <span>{admin ? "Append-Only Audit" : "Role-Based Access"}</span>
            </span>
            <span className="security-chip">
              <Icon name="activity" size={13} />
              <span>{admin ? "Real-Time Observability" : "Automated Workflows"}</span>
            </span>
          </div>
        </div>

        <div className="auth-story-visual" aria-hidden="true">
          <img
            src={admin ? "/brand/crmkaro-admin-hero.jpg" : "/brand/crmkaro-admin-hero.jpg"}
            alt="CRMKaro Workspace Console"
          />
          <span className="auth-visual-pill pill-one">
            {admin ? "⚡ Live Platform Metrics" : "🚀 All Modules Active"}
          </span>
          <span className="auth-visual-pill pill-two">
            {admin ? "🔒 256-Bit Encrypted Session" : "💼 GST & TDS Ready"}
          </span>
        </div>

        <small className="auth-story-footer">
          {admin
            ? "CRMKaro Platform Engine · Zero-Trust Access Architecture"
            : "Secure sessions · Tenant isolation · Audit logging"}
        </small>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-form-card">
          <form className="auth-form" onSubmit={submit}>
            <h2>{admin ? "Platform Sign In" : "Welcome Back"}</h2>
            <p>
              {admin
                ? "Sign in with your verified platform administrator credentials."
                : "Sign in to access your business organisation."}
            </p>

            <a className="google-button" href={googleStartUrl}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.547 0 9s.348 2.827.957 4.039l3.007-2.332z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
                />
              </svg>
              <span>Continue with Google</span>
            </a>

            <div className="auth-divider">
              <span>or sign in with email</span>
            </div>

            <label htmlFor={challengeId ? "code" : "email"}>
              {challengeId ? "6-Digit Verification Code" : "Work Email Address"}
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
                autoFocus
                required
              />
            ) : (
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
                required
              />
            )}

            <button className="primary-button auth-submit" disabled={busy}>
              {busy
                ? "Verifying…"
                : challengeId
                  ? "Verify Code & Sign In"
                  : "Send Login Code"}
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
                ← Use a different email
              </button>
            )}

            {message && (
              <p className="auth-message" role="status">
                {message}
              </p>
            )}

            <p className="auth-note">
              <Icon name="shield" size={13} />
              <span>Protected by high-security token exchange</span>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
