"use client";

import type { NavItem, OrganisationSummary } from "@crmkaro/ui";
import { useRouter } from "next/navigation";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";

export const SERVICE_NAV_MAP: Record<string, NavItem> = {
  people: { label: "Members", icon: "people", href: "/people" },
  groups: { label: "Groups", icon: "activity", href: "/groups" },
  "quick-collect": { label: "Quick Collect", icon: "zap", href: "/quick-collect" },
  transactions: { label: "Transactions", icon: "transactions", href: "/transactions" },
  students: { label: "Students & Attendance", icon: "student", href: "/students" },
  crm: { label: "Leads & CRM", icon: "crm", href: "/crm" },
  finance: { label: "Finance & Fees", icon: "finance", href: "/finance" },
  payroll: { label: "Staff & Salary", icon: "payroll", href: "/payroll" },
  inventory: { label: "Inventory & Stock", icon: "inventory", href: "/inventory" },
};

export const ALL_AVAILABLE_SERVICES = [
  {
    code: "people",
    name: "People & Directory",
    label: "Members",
    icon: "people" as const,
    detail: "Centralized directory for customers, students, members, and employees.",
    desc: "Centralized directory for customers, students, members, and employees.",
  },
  {
    code: "groups",
    name: "Groups & Batches",
    label: "Groups",
    icon: "activity" as const,
    detail: "Batch management, group dues, multi-member rosters, and group attendance.",
    desc: "Batch management, group dues, multi-member rosters, and group attendance.",
  },
  {
    code: "quick-collect",
    name: "Quick Collect",
    label: "Quick Collect",
    icon: "zap" as const,
    detail: "1-Click WhatsApp payment link and instant fee collection reminders.",
    desc: "1-Click WhatsApp payment link and instant fee collection reminders.",
  },
  {
    code: "transactions",
    name: "Transactions",
    label: "Transactions",
    icon: "transactions" as const,
    detail: "Payment history, receipts, invoices, and transaction logs.",
    desc: "Payment history, receipts, invoices, and transaction logs.",
  },
  {
    code: "students",
    name: "Students & Attendance",
    label: "Students & Attendance",
    icon: "student" as const,
    detail: "Student admissions, recurring fee cycle rolling ledger, and daily attendance tracking.",
    desc: "Student admissions, recurring fee cycle rolling ledger, and daily attendance tracking.",
  },
  {
    code: "crm",
    name: "Leads & CRM",
    label: "Leads & CRM",
    icon: "crm" as const,
    detail: "Sales pipelines, inquiry management, follow-ups, and lead conversion.",
    desc: "Sales pipelines, inquiry management, follow-ups, and lead conversion.",
  },
  {
    code: "finance",
    name: "Finance & Fees",
    label: "Finance & Fees",
    icon: "finance" as const,
    detail: "Student fees, invoices, payments receipts, and expense tracking.",
    desc: "Student fees, invoices, payments receipts, and expense tracking.",
  },
  {
    code: "payroll",
    name: "Staff & Salary",
    label: "Staff & Salary",
    icon: "payroll" as const,
    detail: "Staff compensation, monthly payroll runs, and payslips.",
    desc: "Staff compensation, monthly payroll runs, and payslips.",
  },
  {
    code: "inventory",
    name: "Inventory & Stock",
    label: "Inventory & Stock",
    icon: "inventory" as const,
    detail: "Product catalog, items, stock movement, and inventory ledger.",
    desc: "Product catalog, items, stock movement, and inventory ledger.",
  },
] as const;

export const DEFAULT_SERVICE_CODES = [
  "students",
  "people",
  "groups",
  "quick-collect",
  "transactions",
  "crm",
  "finance",
  "payroll",
  "inventory",
];

export function getActiveServicesFromStorage(): string[] {
  if (typeof window === "undefined") return DEFAULT_SERVICE_CODES;
  try {
    const raw = localStorage.getItem("crmkaro_active_services");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_SERVICE_CODES;
}

export function saveActiveServicesToStorage(services: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("crmkaro_active_services", JSON.stringify(services));
  } catch {}
}

export type WorkspaceContext = {
  orgName: string;
  userName: string;
  userRole: string;
  currency: string;
  businessType?: string;
  activeServices: string[];
};

export const DEFAULT_WORKSPACE_CONTEXT: WorkspaceContext = {
  orgName: "CRMKaro Workspace",
  userName: "Workspace User",
  userRole: "Owner",
  currency: "INR",
  businessType: "Business",
  activeServices: DEFAULT_SERVICE_CODES,
};

// In-memory singletons to guarantee instant zero-flicker transitions across routes
let inMemoryWorkspaceContext: WorkspaceContext | null = null;
let inMemoryOrganisations: OrganisationSummary[] = [];
let hasInitialClientHydrationCompleted = false;

export function getInitialWorkspaceContext(): WorkspaceContext {
  if (hasInitialClientHydrationCompleted && inMemoryWorkspaceContext) {
    return inMemoryWorkspaceContext;
  }
  return DEFAULT_WORKSPACE_CONTEXT;
}

export function getCachedWorkspaceContext(): WorkspaceContext {
  if (inMemoryWorkspaceContext) {
    return inMemoryWorkspaceContext;
  }
  if (typeof window === "undefined") {
    return DEFAULT_WORKSPACE_CONTEXT;
  }
  try {
    const raw = localStorage.getItem("crmkaro_workspace_context");
    if (raw) {
      const parsed = JSON.parse(raw);
      inMemoryWorkspaceContext = {
        orgName: parsed.orgName || "CRMKaro Workspace",
        userName: parsed.userName || "Workspace User",
        userRole: parsed.userRole || "Owner",
        currency: parsed.currency || "INR",
        businessType: parsed.businessType || "Business",
        activeServices: Array.isArray(parsed.activeServices) && parsed.activeServices.length > 0
          ? parsed.activeServices
          : getActiveServicesFromStorage(),
      };
      return inMemoryWorkspaceContext;
    }
  } catch {}
  inMemoryWorkspaceContext = {
    orgName: "CRMKaro Workspace",
    userName: "Workspace User",
    userRole: "Owner",
    currency: "INR",
    businessType: "Business",
    activeServices: getActiveServicesFromStorage(),
  };
  return inMemoryWorkspaceContext;
}

export function saveCachedWorkspaceContext(ctx: Partial<WorkspaceContext>) {
  if (typeof window === "undefined") return;
  try {
    const current = getCachedWorkspaceContext();
    const updated = { ...current, ...ctx };
    inMemoryWorkspaceContext = updated;
    localStorage.setItem("crmkaro_workspace_context", JSON.stringify(updated));
    if (ctx.activeServices && Array.isArray(ctx.activeServices)) {
      saveActiveServicesToStorage(ctx.activeServices);
    }
  } catch {}
}

export function buildNavItems(activeServices: string[]): NavItem[] {
  const codes = activeServices && activeServices.length > 0 ? activeServices : DEFAULT_SERVICE_CODES;
  const codesSet = new Set(codes);

  const orderedCodes = [
    "people",
    "groups",
    "quick-collect",
    "transactions",
    "students",
    "crm",
    "finance",
    "payroll",
    "inventory",
  ];
  const serviceNavItems = orderedCodes
    .filter((code) => codesSet.has(code))
    .map((code) => SERVICE_NAV_MAP[code])
    .filter((item): item is NavItem => Boolean(item));

  return [
    { label: "Dashboard", icon: "home", href: "/" },
    ...serviceNavItems,
    { label: "Settings", icon: "settings", href: "/settings" },
  ];
}

export type WorkspaceContextValue = {
  orgName: string;
  userName: string;
  userRole: string;
  currency: string;
  businessType: string;
  activeServices: string[];
  organisations: OrganisationSummary[];
  navItems: NavItem[];
  isHydrated: boolean;
  updateWorkspace: (ctx: Partial<WorkspaceContext>) => void;
  setOrganisations: React.Dispatch<React.SetStateAction<OrganisationSummary[]>>;
  refreshWorkspace: () => Promise<void>;
};

const WorkspaceReactContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<WorkspaceContext>(() => getInitialWorkspaceContext());
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>(() => inMemoryOrganisations);
  const [isHydrated, setIsHydrated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    hasInitialClientHydrationCompleted = true;
    setIsHydrated(true);
    const cached = getCachedWorkspaceContext();
    setContext(cached);
  }, []);

  // Background Route Pre-warming
  // Next.js development server compiles routes JIT (on-demand on first request).
  // By prefetching primary routes in background right after mount/login, Next.js compiles
  // and caches them in memory so first clicks are instant (40ms instead of 1.5s+).
  useEffect(() => {
    if (!isHydrated) return;
    const routesToWarm = [
      "/transactions",
      "/settings",
      "/people",
      "/groups",
      "/quick-collect",
      "/students",
      "/crm",
      "/finance",
      "/payroll",
      "/inventory",
    ];
    const timer = setTimeout(() => {
      routesToWarm.forEach((route, index) => {
        setTimeout(() => {
          try {
            router.prefetch(route);
          } catch {}
        }, index * 120);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [isHydrated, router]);

  const updateWorkspace = useCallback((updates: Partial<WorkspaceContext>) => {
    saveCachedWorkspaceContext(updates);
    setContext((prev) => ({ ...prev, ...updates }));
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const api = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL
        : "http://localhost:4000/api/v1";

      const meRes = await fetch(`${api}/auth/me`, { credentials: "include" }).catch(() => null);
      let newUserName = "";
      if (meRes && meRes.ok) {
        const meData = await meRes.json();
        if (meData.user?.name) {
          newUserName = meData.user.name;
        }
      }

      const orgsRes = await fetch(`${api}/organisations`, { credentials: "include" }).catch(() => null);
      if (orgsRes && orgsRes.ok) {
        const orgList = await orgsRes.json();
        const activeEntry = orgList.find((o: any) => o.organisation);
        if (activeEntry?.organisation) {
          const oName = activeEntry.organisation.name;
          const rName = activeEntry.role?.name || "Owner";
          const bType = activeEntry.organisation.businessType || "Business";
          const srvs = activeEntry.activeServices || activeEntry.organisation.activeServices;
          const updates: Partial<WorkspaceContext> = {
            orgName: oName,
            userRole: rName,
            businessType: bType,
          };
          if (newUserName) updates.userName = newUserName;
          if (Array.isArray(srvs) && srvs.length > 0) {
            updates.activeServices = srvs;
          }
          updateWorkspace(updates);
        }
        const orgSummaries = orgList
          .map((o: any) => o.organisation)
          .filter(Boolean);
        inMemoryOrganisations = orgSummaries;
        setOrganisations(orgSummaries);
      }
    } catch {}
  }, [updateWorkspace]);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  const navItems = useMemo(
    () => buildNavItems(context.activeServices),
    [context.activeServices],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      orgName: context.orgName,
      userName: context.userName,
      userRole: context.userRole,
      currency: context.currency,
      businessType: context.businessType || "Business",
      activeServices: context.activeServices,
      organisations,
      navItems,
      isHydrated,
      updateWorkspace,
      setOrganisations,
      refreshWorkspace,
    }),
    [context, organisations, navItems, isHydrated, updateWorkspace, refreshWorkspace],
  );

  return React.createElement(
    WorkspaceReactContext.Provider,
    { value },
    children,
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceReactContext);
  if (!ctx) {
    const cached = getCachedWorkspaceContext();
    return {
      orgName: cached.orgName,
      userName: cached.userName,
      userRole: cached.userRole,
      currency: cached.currency,
      businessType: cached.businessType || "Business",
      activeServices: cached.activeServices,
      organisations: inMemoryOrganisations,
      navItems: buildNavItems(cached.activeServices),
      isHydrated: true,
      updateWorkspace: saveCachedWorkspaceContext,
      setOrganisations: () => {},
      refreshWorkspace: async () => {},
    };
  }
  return ctx;
}

export function useWorkspaceContext(): {
  context: WorkspaceContext;
  isMounted: boolean;
  nav: NavItem[];
  setContext: React.Dispatch<React.SetStateAction<WorkspaceContext>>;
} {
  const ws = useWorkspace();
  return {
    context: {
      orgName: ws.orgName,
      userName: ws.userName,
      userRole: ws.userRole,
      currency: ws.currency,
      businessType: ws.businessType,
      activeServices: ws.activeServices,
    },
    isMounted: ws.isHydrated,
    nav: ws.navItems,
    setContext: (setter: any) => {
      if (typeof setter === "function") {
        const next = setter({
          orgName: ws.orgName,
          userName: ws.userName,
          userRole: ws.userRole,
          currency: ws.currency,
          businessType: ws.businessType,
          activeServices: ws.activeServices,
        });
        ws.updateWorkspace(next);
      } else if (setter) {
        ws.updateWorkspace(setter);
      }
    },
  };
}
