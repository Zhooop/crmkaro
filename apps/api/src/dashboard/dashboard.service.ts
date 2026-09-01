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
  actionLabel?: string;
  actionHref?: string;
};

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  summary(
    organisationId: string,
    userId: string,
    roleId: string,
    query?: { startDate?: string; endDate?: string },
  ) {
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
        tone?: "blue" | "emerald" | "amber" | "rose" | "purple" | "teal";
      }> = [];
      const notifications: DashboardNotification[] = [];
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      // Date range filtering setup
      const paymentWhere: any = { organisationId };
      const invoiceWhere: any = {
        organisationId,
        status: { in: ["DRAFT", "ISSUED", "PARTIALLY_PAID"] },
      };

      let isDateFiltered = false;
      if (query?.startDate || query?.endDate) {
        isDateFiltered = true;
        paymentWhere.receivedAt = {};
        invoiceWhere.createdAt = {};

        if (query.startDate) {
          const start = new Date(query.startDate);
          paymentWhere.receivedAt.gte = start;
          invoiceWhere.createdAt.gte = start;
        }
        if (query.endDate) {
          const end = new Date(query.endDate);
          end.setHours(23, 59, 59, 999);
          paymentWhere.receivedAt.lte = end;
          invoiceWhere.createdAt.lte = end;
        }
      }

      // 1. Universal Core KPI 1: Total Active Members / Directory
      const totalMembersCount = await tx.person.count({
        where: { organisationId, status: "ACTIVE" },
      });
      cards.push({
        key: "total_members",
        label: "Total Members",
        value: totalMembersCount,
        detail: "Active students, clients & contacts",
        format: "number",
        tone: "blue",
      });

      // 2. Universal Core KPI 2: Total Amount Received (Filtered by date range)
      const totalPayments = await tx.payment.aggregate({
        where: paymentWhere,
        _sum: { amountMinor: true },
        _count: true,
      });
      const totalReceivedMinor = totalPayments._sum.amountMinor ?? 0;
      cards.push({
        key: "total_received",
        label: isDateFiltered ? "Amount Received (In Range)" : "Total Amount Received",
        value: totalReceivedMinor,
        detail: `${totalPayments._count} payment${totalPayments._count === 1 ? "" : "s"} recorded`,
        format: "money",
        tone: "emerald",
      });

      // 3. Universal Core KPI 3: Total Amount Due (Pending balances on active invoices)
      const pendingInvoices = await tx.invoice.aggregate({
        where: invoiceWhere,
        _sum: { balanceDueMinor: true },
        _count: true,
      });
      const totalDueMinor = pendingInvoices._sum.balanceDueMinor ?? 0;
      cards.push({
        key: "total_due",
        label: isDateFiltered ? "Amount Due (In Range)" : "Total Amount Due",
        value: totalDueMinor,
        detail:
          totalDueMinor > 0
            ? `${pendingInvoices._count} invoice${pendingInvoices._count === 1 ? "" : "s"} pending`
            : "All dues cleared",
        format: "money",
        tone: totalDueMinor > 0 ? "rose" : "teal",
      });

      if (totalDueMinor > 0 && !isDateFiltered) {
        notifications.push({
          id: "dues-pending-alert",
          module: "finance",
          title: `₹${(totalDueMinor / 100).toLocaleString("en-IN")} Dues Pending`,
          detail: `${pendingInvoices._count} invoice(s) have unpaid or partial balances.`,
          severity: "warning",
          actionLabel: "Collect Payment",
          actionHref: "/transactions",
        });
      }

      // 4. Groups & Batches Module
      if (services.has("groups")) {
        const groupCount = await tx.batchGroup.count({
          where: { organisationId, isActive: true },
        });
        const groupMembersCount = await tx.groupMember.count({
          where: { organisationId, status: "ACTIVE" },
        });
        cards.push({
          key: "active_groups",
          label: "Active Groups & Batches",
          value: groupCount,
          detail: `${groupMembersCount} member${groupMembersCount === 1 ? "" : "s"} assigned`,
          format: "number",
          tone: "purple",
        });
      }

      // 5. Students & Tuition Academy Module
      if (services.has("students")) {
        const studentCount = await tx.studentProfile.count({
          where: { organisationId, status: "ACTIVE" },
        });

        // Today's attendance
        const todayAttendance = await tx.attendanceRecord.findMany({
          where: { organisationId, date: todayDate },
          select: { status: true },
        });
        const presentToday = todayAttendance.filter((a) => a.status === "PRESENT").length;

        if (todayAttendance.length > 0) {
          const attPct = studentCount > 0 ? Math.round((presentToday / studentCount) * 100) : 0;
          cards.push({
            key: "students_attendance",
            label: "Today's Attendance",
            value: presentToday,
            detail: `${attPct}% present (${studentCount - presentToday} absent/leave)`,
            format: "number",
            tone: "teal",
          });
        } else if (studentCount > 0) {
          notifications.push({
            id: "attendance-pending-today",
            module: "students",
            title: "Today's Attendance Pending",
            detail: "Attendance has not been recorded yet for today.",
            severity: "info",
            actionLabel: "Mark Attendance",
            actionHref: "/students",
          });
        }
      }

      // 6. CRM & Leads Module
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
          label: "Active Leads & Inquiries",
          value: open,
          detail: due > 0 ? `${due} follow-up${due === 1 ? "" : "s"} due today` : "All follow-ups updated",
          format: "number",
          tone: "amber",
        });
        if (due > 0) {
          notifications.push({
            id: "crm-followups",
            module: "crm",
            title: `${due} Lead Follow-up${due === 1 ? "" : "s"} Due`,
            detail: "Prospective customer follow-up scheduled for today.",
            severity: "warning",
            actionLabel: "Open CRM",
            actionHref: "/crm",
          });
        }
      }

      // 7. Finance & Invoices Module Overdue Alerts
      if (services.has("finance") && permissions.has("finance.invoice.read")) {
        const overdue = await tx.invoice.count({
          where: {
            organisationId,
            status: { in: ["ISSUED", "PARTIALLY_PAID"] },
            dueDate: { lt: new Date() },
          },
        });
        if (overdue > 0) {
          notifications.push({
            id: "finance-overdue",
            module: "finance",
            title: `${overdue} Overdue Invoice${overdue === 1 ? "" : "s"}`,
            detail: "Payment follow-up required.",
            severity: "critical",
            actionLabel: "View Invoices",
            actionHref: "/transactions",
          });
        }
      }

      // 5. Inventory Module
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
          label: "Stock & Products",
          value: products.length,
          detail: low > 0 ? `⚠️ ${low} items low in stock` : "All stock levels healthy",
          format: "number",
          tone: "teal",
        });
        if (low > 0) {
          notifications.push({
            id: "inventory-low",
            module: "inventory",
            title: `${low} Low-Stock Product${low === 1 ? "" : "s"}`,
            detail: "Reordering stock recommended.",
            severity: "warning",
            actionLabel: "View Inventory",
            actionHref: "/inventory",
          });
        }
      }

      // 6. Payroll Module
      if (services.has("payroll") && permissions.has("payroll.salary.view")) {
        const staffCount = await tx.employee.count({
          where: { organisationId, status: "ACTIVE" },
        });
        cards.push({
          key: "payroll",
          label: "Active Staff",
          value: staffCount,
          detail: "Salaries and attendance",
          format: "number",
          tone: "purple",
        });
      }

      // Recent Transactions (Collections & Invoices)
      const recentPayments = await tx.payment.findMany({
        where: paymentWhere,
        orderBy: { receivedAt: "desc" },
        take: isDateFiltered ? 20 : 5,
        include: {
          person: { select: { displayName: true } },
          invoice: { select: { invoiceNumber: true } },
        },
      });

      const transactions = recentPayments.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        personName: p.person?.displayName || "Customer / Student",
        invoiceNumber: p.invoice?.invoiceNumber || "—",
        amountMinor: p.amountMinor,
        method: p.method,
        receivedAt: p.receivedAt.toISOString(),
      }));

      // Recent Activity Stream
      const activity = await tx.auditLog.findMany({
        where: { organisationId },
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
          metadata: true,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      });

      const sessionCount = await tx.authSession.count({
        where: { userId },
      });

      const org = await tx.organisation.findUnique({
        where: { id: organisationId },
        select: { id: true, name: true, currency: true, timezone: true, businessType: true, createdAt: true },
      });

      return {
        organisation: org,
        role: role ? { code: role.code, name: role.name } : null,
        services: [...services],
        cards,
        notifications,
        transactions,
        activity,
        dateFilter: {
          startDate: query?.startDate || null,
          endDate: query?.endDate || null,
          isFiltered: isDateFiltered,
        },
        isNewUser: sessionCount <= 1,
        generatedAt: new Date().toISOString(),
      };
    });
  }
}
