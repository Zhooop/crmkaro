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
        tone?: "blue" | "emerald" | "amber" | "rose" | "purple" | "teal";
      }> = [];
      const notifications: DashboardNotification[] = [];
      const currentMonth = new Date().toISOString().slice(0, 7);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      // 1. Students & Tuition Academy Module
      if (services.has("students")) {
        const studentCount = await tx.studentProfile.count({
          where: { organisationId, status: "ACTIVE" },
        });

        const studentsWithPlan = await tx.studentProfile.findMany({
          where: { organisationId, status: "ACTIVE" },
          select: { id: true, personId: true, feeAmountMinor: true },
        });

        // Current month student fee cycle metrics
        const studentInvoices = await tx.invoice.findMany({
          where: { organisationId, notes: { contains: currentMonth } },
          select: { personId: true, paidTotalMinor: true, grandTotalMinor: true, balanceDueMinor: true },
        });

        const invoiceMap = new Map<string, (typeof studentInvoices)[0]>();
        for (const inv of studentInvoices) {
          invoiceMap.set(inv.personId, inv);
        }

        let monthCollectedMinor = 0;
        let monthPendingMinor = 0;
        let pendingStudentsCount = 0;

        for (const std of studentsWithPlan) {
          const inv = invoiceMap.get(std.personId);
          const feePlan = std.feeAmountMinor || 0;
          const paid = inv?.paidTotalMinor || 0;
          const due = inv ? Math.max(0, Math.max(feePlan, inv.grandTotalMinor) - paid) : feePlan;
          monthCollectedMinor += paid;
          monthPendingMinor += due;
          if (due > 0) pendingStudentsCount++;
        }

        // Today's attendance
        const todayAttendance = await tx.attendanceRecord.findMany({
          where: { organisationId, date: todayDate },
          select: { status: true },
        });
        const presentToday = todayAttendance.filter((a) => a.status === "PRESENT").length;

        cards.push({
          key: "students",
          label: "Enrolled Students",
          value: studentCount,
          detail: `${studentsWithPlan.length} active in fee plan`,
          format: "number",
          tone: "blue",
        });

        cards.push({
          key: "students_fees",
          label: "Fee Collection (This Month)",
          value: monthCollectedMinor,
          detail: monthPendingMinor > 0 ? `₹${(monthPendingMinor / 100).toLocaleString("en-IN")} pending dues` : "All fees cleared",
          format: "money",
          tone: "emerald",
        });

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

        if (monthPendingMinor > 0) {
          notifications.push({
            id: "fees-pending-month",
            module: "students",
            title: `₹${(monthPendingMinor / 100).toLocaleString("en-IN")} Fees Pending`,
            detail: `${pendingStudentsCount} student(s) have unpaid or partial dues this month.`,
            severity: "warning",
            actionLabel: "Collect Fees",
            actionHref: "/students",
          });
        }
      }

      // 2. People & Directory Module
      if (services.has("people") && permissions.has("people.read")) {
        const count = await tx.person.count({
          where: { organisationId, status: "ACTIVE" },
        });
        cards.push({
          key: "people",
          label: "Directory & Contacts",
          value: count,
          detail: "Students, customers, guardians & team",
          format: "number",
          tone: "purple",
        });
      }

      // 3. CRM & Leads Module
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

      // 4. Finance & Billing Module
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
        if (!services.has("students")) {
          cards.push({
            key: "finance",
            label: "Pending Receivables",
            value: due._sum.balanceDueMinor ?? 0,
            detail: `${due._count} invoices pending`,
            format: "money",
            tone: "rose",
          });
        }
        if (overdue > 0) {
          notifications.push({
            id: "finance-overdue",
            module: "finance",
            title: `${overdue} Overdue Invoice${overdue === 1 ? "" : "s"}`,
            detail: "Payment follow-up required.",
            severity: "critical",
            actionLabel: "View Invoices",
            actionHref: "/finance",
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
        where: { organisationId },
        orderBy: { receivedAt: "desc" },
        take: 5,
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
        isNewUser: sessionCount <= 1,
        generatedAt: new Date().toISOString(),
      };
    });
  }
}
