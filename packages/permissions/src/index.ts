export const permissions = [
  "organisation.settings.read",
  "organisation.settings.update",
  "organisation.member.manage",
  "organisation.service.manage",
  "people.read",
  "people.create",
  "people.update",
  "people.archive",
  "people.import",
  "people.export",
  "crm.lead.read",
  "crm.lead.create",
  "crm.lead.update",
  "crm.lead.assign",
  "crm.lead.convert",
  "finance.invoice.read",
  "finance.invoice.manage",
  "finance.payment.read",
  "finance.payment.create",
  "finance.payment.refund",
  "finance.expense.manage",
  "payroll.employee.read",
  "payroll.employee.manage",
  "payroll.salary.view",
  "payroll.run.prepare",
  "payroll.run.approve",
  "payroll.run.markPaid",
  "inventory.product.read",
  "inventory.product.manage",
  "inventory.stock.manage",
  "inventory.negativeStock.override",
  "audit.read",
] as const;

export type Permission = (typeof permissions)[number];

export const rolePresets = {
  owner: { name: "Owner", permissions: [...permissions] },
  admin: {
    name: "Admin",
    permissions: permissions.filter((permission) => permission !== "organisation.service.manage"),
  },
  sales: {
    name: "Sales",
    permissions: [
      "people.read", "people.create", "people.update",
      "crm.lead.read", "crm.lead.create", "crm.lead.update", "crm.lead.assign", "crm.lead.convert",
    ],
  },
  accountant: {
    name: "Accountant",
    permissions: [
      "people.read", "finance.invoice.read", "finance.invoice.manage",
      "finance.payment.read", "finance.payment.create", "finance.payment.refund",
      "finance.expense.manage", "payroll.employee.read", "payroll.run.markPaid",
    ],
  },
  hr: {
    name: "HR",
    permissions: [
      "people.read", "payroll.employee.read", "payroll.employee.manage",
      "payroll.salary.view", "payroll.run.prepare",
    ],
  },
  staff: {
    name: "Staff",
    permissions: ["people.read", "inventory.product.read", "inventory.stock.manage"],
  },
} as const satisfies Record<string, { name: string; permissions: readonly Permission[] }>;

export type RolePresetCode = keyof typeof rolePresets;
