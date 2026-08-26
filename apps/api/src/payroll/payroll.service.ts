import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseClient, Prisma } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import PDFDocument from "pdfkit";
import { DATABASE } from "../database/database.module.js";
import type { EmployeeInput, SalaryStructureInput } from "./payroll.schemas.js";
import { calculateSalary } from "./payroll.utils.js";

const employeeInclude = {
  person: true,
  salaryStructures: { orderBy: { effectiveFrom: "desc" as const } },
} as const;

@Injectable()
export class PayrollService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}
  private context<T>(
    organisationId: string,
    userId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return withTenant(this.database, organisationId, userId, operation);
  }
  listEmployees(
    organisationId: string,
    userId: string,
    status?: "ACTIVE" | "EXITED",
  ) {
    return this.context(organisationId, userId, (tx) =>
      tx.employee.findMany({
        where: { organisationId, status },
        include: employeeInclude,
        orderBy: { employeeCode: "asc" },
      }),
    );
  }
  createEmployee(organisationId: string, userId: string, input: EmployeeInput) {
    return this.context(organisationId, userId, async (tx) => {
      const person = await tx.person.findFirst({
        where: { id: input.personId, organisationId, status: "ACTIVE" },
      });
      if (!person)
        throw new BadRequestException("Active person record not found.");
      const employee = await tx.employee.create({
        data: { organisationId, ...input },
        include: employeeInclude,
      });
      await tx.personTypeAssignment.upsert({
        where: {
          personId_type: { personId: input.personId, type: "EMPLOYEE" },
        },
        update: {},
        create: { organisationId, personId: input.personId, type: "EMPLOYEE" },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "employee.created",
          entityType: "employee",
          entityId: employee.id,
        },
      });
      return employee;
    });
  }
  exitEmployee(
    organisationId: string,
    userId: string,
    id: string,
    exitDate: Date,
  ) {
    return this.context(organisationId, userId, async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id, organisationId },
      });
      if (!employee) throw new NotFoundException("Employee not found.");
      if (exitDate < employee.joiningDate)
        throw new BadRequestException(
          "Exit date cannot be before joining date.",
        );
      const result = await tx.employee.update({
        where: { id },
        data: { status: "EXITED", exitDate },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "employee.exited",
          entityType: "employee",
          entityId: id,
        },
      });
      return result;
    });
  }
  addSalary(
    organisationId: string,
    userId: string,
    employeeId: string,
    input: SalaryStructureInput,
  ) {
    return this.context(organisationId, userId, async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: employeeId, organisationId },
      });
      if (!employee) throw new NotFoundException("Employee not found.");
      const salary = await tx.salaryStructure.create({
        data: { organisationId, employeeId, ...input },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "salary_structure.created",
          entityType: "salary_structure",
          entityId: salary.id,
          metadata: { employeeId, effectiveFrom: input.effectiveFrom },
        },
      });
      return salary;
    });
  }
  listRuns(organisationId: string, userId: string) {
    return this.context(organisationId, userId, (tx) =>
      tx.payrollRun.findMany({
        where: { organisationId },
        include: { _count: { select: { items: true } } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      }),
    );
  }
  prepareRun(
    organisationId: string,
    userId: string,
    year: number,
    month: number,
  ) {
    return this.context(organisationId, userId, async (tx) => {
      const existing = await tx.payrollRun.findUnique({
        where: { organisationId_year_month: { organisationId, year, month } },
      });
      if (existing)
        throw new ConflictException("Payroll for this month already exists.");
      const periodEnd = new Date(Date.UTC(year, month, 0));
      const employees = await tx.employee.findMany({
        where: {
          organisationId,
          joiningDate: { lte: periodEnd },
          OR: [
            { status: "ACTIVE" },
            { exitDate: { gte: new Date(Date.UTC(year, month - 1, 1)) } },
          ],
        },
        include: {
          salaryStructures: {
            where: { effectiveFrom: { lte: periodEnd } },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
          },
        },
      });
      const missing = employees.filter(
        (employee) => !employee.salaryStructures[0],
      );
      if (missing.length)
        throw new BadRequestException(
          `Salary structure missing for: ${missing.map((employee) => employee.employeeCode).join(", ")}`,
        );
      if (!employees.length)
        throw new BadRequestException("No eligible employees found.");
      const run = await tx.payrollRun.create({
        data: {
          organisationId,
          year,
          month,
          preparedById: userId,
          items: {
            create: employees.map((employee) => {
              const salary = employee.salaryStructures[0]!;
              const { grossMinor, netMinor } = calculateSalary(
                salary.basicMinor,
                salary.allowancesMinor,
                salary.deductionsMinor,
              );
              return {
                organisationId,
                employeeId: employee.id,
                basicMinor: salary.basicMinor,
                allowancesMinor: salary.allowancesMinor,
                deductionsMinor: salary.deductionsMinor,
                grossMinor,
                netMinor,
                currency: salary.currency,
              };
            }),
          },
        },
        include: {
          items: { include: { employee: { include: { person: true } } } },
        },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "payroll.prepared",
          entityType: "payroll_run",
          entityId: run.id,
          metadata: { year, month, employees: run.items.length },
        },
      });
      return run;
    });
  }
  private async run(
    tx: Prisma.TransactionClient,
    organisationId: string,
    id: string,
  ) {
    const run = await tx.payrollRun.findFirst({
      where: { id, organisationId },
      include: {
        items: { include: { employee: { include: { person: true } } } },
      },
    });
    if (!run) throw new NotFoundException("Payroll run not found.");
    return run;
  }
  approveRun(organisationId: string, userId: string, id: string) {
    return this.context(organisationId, userId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM payroll_runs WHERE id = ${id}::uuid AND organisation_id = ${organisationId}::uuid FOR UPDATE`;
      const run = await this.run(tx, organisationId, id);
      if (run.status !== "DRAFT")
        throw new ConflictException("Only draft payroll can be approved.");
      const result = await tx.payrollRun.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: userId,
          approvedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "payroll.approved",
          entityType: "payroll_run",
          entityId: id,
        },
      });
      return result;
    });
  }
  markPaid(
    organisationId: string,
    userId: string,
    id: string,
    paymentReference: string,
  ) {
    return this.context(organisationId, userId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM payroll_runs WHERE id = ${id}::uuid AND organisation_id = ${organisationId}::uuid FOR UPDATE`;
      const run = await this.run(tx, organisationId, id);
      if (run.status !== "APPROVED")
        throw new ConflictException("Payroll must be approved before payment.");
      const result = await tx.payrollRun.update({
        where: { id },
        data: {
          status: "PAID",
          paidById: userId,
          paidAt: new Date(),
          paymentReference,
        },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "payroll.paid",
          entityType: "payroll_run",
          entityId: id,
          metadata: { paymentReference },
        },
      });
      return result;
    });
  }
  report(organisationId: string, userId: string, year: number) {
    return this.context(organisationId, userId, async (tx) => {
      const rows = await tx.payrollRun.findMany({
        where: { organisationId, year },
        include: { items: true },
        orderBy: { month: "asc" },
      });
      return rows.map((run) => ({
        id: run.id,
        month: run.month,
        status: run.status,
        employees: run.items.length,
        grossMinor: run.items.reduce((sum, item) => sum + item.grossMinor, 0),
        deductionsMinor: run.items.reduce(
          (sum, item) => sum + item.deductionsMinor,
          0,
        ),
        netMinor: run.items.reduce((sum, item) => sum + item.netMinor, 0),
      }));
    });
  }
  async payslip(
    organisationId: string,
    userId: string,
    runId: string,
    employeeId: string,
  ) {
    const item = await this.context(organisationId, userId, (tx) =>
      tx.payrollItem.findFirst({
        where: { organisationId, payrollRunId: runId, employeeId },
        include: {
          payrollRun: true,
          employee: { include: { person: true } },
          organisation: true,
        },
      }),
    );
    if (!item) throw new NotFoundException("Payslip not found.");
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: "A4" }),
        chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc
        .fontSize(20)
        .fillColor("#2457D6")
        .text(item.organisation.name)
        .fillColor("#111827")
        .fontSize(22)
        .text("SALARY SLIP", { align: "right" })
        .moveDown()
        .fontSize(11)
        .text(`Employee: ${item.employee.person.displayName}`)
        .text(`Employee code: ${item.employee.employeeCode}`)
        .text(
          `Period: ${String(item.payrollRun.month).padStart(2, "0")}/${item.payrollRun.year}`,
        )
        .moveDown()
        .text(`Basic: ${item.basicMinor / 100} ${item.currency}`)
        .text(`Allowances: ${item.allowancesMinor / 100} ${item.currency}`)
        .text(`Deductions: ${item.deductionsMinor / 100} ${item.currency}`)
        .fontSize(14)
        .text(`Net salary: ${item.netMinor / 100} ${item.currency}`, {
          align: "right",
        });
      doc.end();
    });
  }
}
