import type { NavItem } from "@crmkaro/ui";

export const SERVICE_NAV_MAP: Record<string, NavItem> = {
  students: { label: "Students & Attendance", icon: "student", href: "/students" },
  people: { label: "People & Directory", icon: "people", href: "/people" },
  crm: { label: "Leads & CRM", icon: "crm", href: "/crm" },
  finance: { label: "Finance & Fees", icon: "finance", href: "/finance" },
  payroll: { label: "Staff & Salary", icon: "payroll", href: "/payroll" },
  inventory: { label: "Inventory & Stock", icon: "inventory", href: "/inventory" },
};

export const ALL_AVAILABLE_SERVICES = [
  {
    code: "students",
    name: "Students & Attendance",
    label: "Students & Attendance",
    icon: "student" as const,
    detail: "Student admissions, recurring fee cycle rolling ledger, and daily attendance tracking.",
    desc: "Student admissions, recurring fee cycle rolling ledger, and daily attendance tracking.",
  },
  {
    code: "people",
    name: "People & Directory",
    label: "People & Directory",
    icon: "people" as const,
    detail: "Centralized directory for customers, students, members, and employees.",
    desc: "Centralized directory for customers, students, members, and employees.",
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

export const DEFAULT_SERVICE_CODES = ["students", "people", "crm", "finance", "payroll", "inventory"];

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

export function buildNavItems(activeServices: string[]): NavItem[] {
  // If activeServices has items, only include those that are active
  const effectiveCodes = activeServices.length > 0 ? activeServices : DEFAULT_SERVICE_CODES;

  const serviceNavItems = effectiveCodes
    .map((code) => SERVICE_NAV_MAP[code])
    .filter((item): item is NavItem => Boolean(item));

  return [
    { label: "Dashboard", icon: "home", href: "/" },
    ...serviceNavItems,
    { label: "Settings", icon: "settings", href: "/settings" },
  ];
}
