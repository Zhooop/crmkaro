import { Inject, Injectable } from "@nestjs/common";
import type { DatabaseClient } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";

type DashboardNotification = {
  id: string;
  module: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
};

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  summary(organisationId: string, userId: string, roleId: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const role = await tx.role.findFirst({
        where: { id: roleId, organisationId },
        include: { permissions: { include: { permission: true } } },
      });
      const enabledServices = await tx.organisationService.findMany({
        where: { organisationId, status: { in: ["ACTIVE", "TRIAL"] } },
        include: { service: true },
      });
      const permissions = new Set(
        role?.permissions.map((item) => item.permission.code) ?? [],
      );
      const services = new Set(
        enabledServices.map((item) => item.service.code),
      );
      const cards: Array<{
        key: string;
        label: string;
        value: number;
        detail: string;
        format: "number" | "money";
      }> = [];
      const notifications: DashboardNotification[] = [];

      if (services.has("people") && permissions.has("people.read")) {
        const count = await tx.person.count({
          where: { organisationId, status: "ACTIVE" },
        });
        cards.push({
          key: "people",
          label: "Active people",
          value: count,
          detail: "Customers, students, members and employees",
          format: "number",
        });
      }
      if (services.has("crm") && permissions.has("crm.lead.read")) {
        const open = await tx.lead.count({
          where: { organisationId, status: "OPEN" },
        });
        const due = await tx.followUp.count({
          where: {
            organisationId,
            status: "SCHEDULED",
            dueAt: { lte: new Date() },
          },
        });
        cards.push({
          key: "crm",
          label: "Open leads",
          value: open,
          detail: `${due} follow-ups due`,
          format: "number",
        });
        if (due)
          notifications.push({
            id: "crm-followups",
            module: "crm",
            title: `${due} follow-up${due === 1 ? "" : "s"} due`,
            detail: "Open CRM to review the follow-up queue.",
            severity: "warning",
          });
      }
      if (services.has("finance") && permissions.has("finance.invoice.read")) {
        const due = await tx.invoice.aggregate({
          where: {
            organisationId,
            status: { in: ["ISSUED", "PARTIALLY_PAID"] },
          },
          _sum: { balanceDueMinor: true },
          _count: true,
        });
        const overdue = await tx.invoice.count({
          where: {
            organisationId,
            status: { in: ["ISSUED", "PARTIALLY_PAID"] },
            dueDate: { lt: new Date() },
          },
        });
        cards.push({
          key: "finance",
          label: "Payments due",
          value: due._sum.balanceDueMinor ?? 0,
          detail: `${due._count} invoices pending`,
          format: "money",
        });
        if (overdue)
          notifications.push({
            id: "finance-overdue",
            module: "finance",
            title: `${overdue} overdue invoice${overdue === 1 ? "" : "s"}`,
            detail: "Payment follow-up may be required.",
            severity: "critical",
          });
      }
      if (
        services.has("inventory") &&
        permissions.has("inventory.product.read")
      ) {
        const products = await tx.product.findMany({
          where: { organisationId, isActive: true },
          select: { currentStock: true, lowStockThreshold: true },
        });
        const low = products.filter((product) =>
          product.currentStock.lte(product.lowStockThreshold),
        ).length;
        cards.push({
          key: "inventory",
          label: "Low stock items",
          value: low,
          detail: `${products.length} active products`,
          format: "number",
        });
        if (low)
          notifications.push({
            id: "inventory-low",
            module: "inventory",
            title: `${low} low-stock item${low === 1 ? "" : "s"}`,
            detail: "Review stock levels before the next sale.",
            severity: "warning",
          });
      }
      if (services.has("payroll") && permissions.has("payroll.salary.view")) {
        const awaiting = await tx.payrollRun.count({
          where: { organisationId, status: "DRAFT" },
        });
        if (awaiting)
          notifications.push({
            id: "payroll-draft",
            module: "payroll",
            title: `${awaiting} payroll draft${awaiting === 1 ? "" : "s"}`,
            detail: "Payroll is waiting for review or approval.",
            severity: "info",
          });
      }

      const activityPrefixes = [
        permissions.has("people.read") ? "person." : null,
        permissions.has("crm.lead.read") ? "lead." : null,
        permissions.has("finance.invoice.read") ? "invoice." : null,
        permissions.has("finance.payment.read") ? "payment." : null,
        permissions.has("payroll.salary.view") ? "payroll." : null,
        permissions.has("inventory.product.read") ? "inventory." : null,
      ].filter((value): value is string => Boolean(value));
      const activity = activityPrefixes.length
        ? await tx.auditLog.findMany({
            where: {
              organisationId,
              OR: activityPrefixes.map((prefix) => ({
                action: { startsWith: prefix },
              })),
            },
            select: {
              id: true,
              action: true,
              entityType: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          })
        : [];

      return {
        organisation: await tx.organisation.findUnique({
          where: { id: organisationId },
          select: { id: true, name: true, currency: true, timezone: true },
        }),
        role: role ? { code: role.code, name: role.name } : null,
        services: [...services],
        cards,
        notifications,
        activity,
      };
    });
  }
}
