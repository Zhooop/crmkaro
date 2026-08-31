import type { NavItem } from "@crmkaro/ui";

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
  "people",
  "groups",
  "quick-collect",
  "transactions",
  "payroll",
];

export function getActiveServicesFromStorage(): string[] {
  if (typeof window === "undefined") return DEFAULT_SERVICE_CODES;
  try {
    const raw = localStorage.getItem("crmkaro_active_services");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
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
  activeServices: string[];
};

export function getCachedWorkspaceContext(): WorkspaceContext {
  if (typeof window === "undefined") {
    return {
      orgName: "CRMKaro Workspace",
      userName: "Workspace User",
      userRole: "Owner",
      currency: "INR",
      activeServices: DEFAULT_SERVICE_CODES,
    };
  }
  try {
    const raw = localStorage.getItem("crmkaro_workspace_context");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        orgName: parsed.orgName || "CRMKaro Workspace",
        userName: parsed.userName || "Workspace User",
        userRole: parsed.userRole || "Owner",
        currency: parsed.currency || "INR",
        activeServices: Array.isArray(parsed.activeServices) ? parsed.activeServices : getActiveServicesFromStorage(),
      };
    }
  } catch {}
  return {
    orgName: "CRMKaro Workspace",
    userName: "Workspace User",
    userRole: "Owner",
    currency: "INR",
    activeServices: getActiveServicesFromStorage(),
  };
}

export function saveCachedWorkspaceContext(ctx: Partial<WorkspaceContext>) {
  if (typeof window === "undefined") return;
  try {
    const current = getCachedWorkspaceContext();
    const updated = { ...current, ...ctx };
    localStorage.setItem("crmkaro_workspace_context", JSON.stringify(updated));
    if (ctx.activeServices) {
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
