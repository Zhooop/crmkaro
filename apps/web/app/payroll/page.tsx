"use client";

import {
  AppShell,
  Badge,
  Drawer,
  EmptyState,
  Icon,
  Modal,
  StatCard,
  Tabs,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const nav: NavItem[] = [
  { label: "Dashboard", icon: "home", href: "/" },
  { label: "People & Directory", icon: "people", href: "/people" },
  { label: "Leads & CRM", icon: "crm", href: "/crm" },
  { label: "Finance & Fees", icon: "finance", href: "/finance" },
  { label: "Staff & Salary", icon: "payroll", href: "/payroll" },
  { label: "Inventory & Stock", icon: "inventory", href: "/inventory" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

type SalaryStructure = {
  id: string;
  effectiveFrom: string;
  basicSalaryMinor: number;
  hraMinor: number;
  allowancesMinor: number;
  deductionsMinor: number;
};

type Employee = {
  id: string;
  personId: string;
  employeeCode: string;
  department: string | null;
  designation: string | null;
  joiningDate: string;
  exitDate: string | null;
  status: "ACTIVE" | "EXITED";
  person: { id: string; displayName: string; email: string | null; primaryPhone: string | null };
  salaryStructures: SalaryStructure[];
};

type PayrollRunItem = {
  id: string;
  employeeId: string;
  employee: {
    employeeCode: string;
    person: { displayName: string; email: string | null };
  };
  basicSalaryMinor: number;
  hraMinor: number;
  allowancesMinor: number;
  deductionsMinor: number;
  netPayableMinor: number;
  status: string;
};

type PayrollRun = {
  id: string;
  year: number;
  month: number;
  status: "DRAFT" | "APPROVED" | "PAID";
  totalGrossMinor: number;
  totalDeductionsMinor: number;
  totalNetMinor: number;
  createdAt: string;
  items: PayrollRunItem[];
};

type PersonOption = {
  id: string;
  displayName: string;
  email: string | null;
  primaryPhone?: string | null;
  types?: Array<{ type: string }>;
};

function formatMoney(amountMinor: number | null | undefined, currency = "INR") {
  if (!amountMinor) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PayrollPage() {
  const router = useRouter();
  const api =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" && window.location.hostname.endsWith("crmkaro.com")
      ? "https://api.crmkaro.com/api/v1"
      : "http://localhost:4000/api/v1");

  // Data states
  const [activeTab, setActiveTab] = useState<"employees" | "runs">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }

  // Context & AppShell info
  const [orgName, setOrgName] = useState("CRMKaro Workspace");
  const [userName, setUserName] = useState("Workspace User");
  const [userRole, setUserRole] = useState("HR");
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);

  // Modals & Drawers
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [prepareRunOpen, setPrepareRunOpen] = useState(false);
  const [detailRun, setDetailRun] = useState<PayrollRun | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Form states - Add Employee
  const [formPersonId, setFormPersonId] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDept, setFormDept] = useState("Operations");
  const [formDesig, setFormDesig] = useState("Associate");
  const [formJoiningDate, setFormJoiningDate] = useState(new Date().toISOString().slice(0, 10));
  const [empBusy, setEmpBusy] = useState(false);
  const [empError, setEmpError] = useState("");

  // Form states - Salary Structure
  const [basicPay, setBasicPay] = useState("");
  const [hra, setHra] = useState("");
  const [allowances, setAllowances] = useState("");
  const [deductions, setDeductions] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [salaryBusy, setSalaryBusy] = useState(false);
  const [salaryError, setSalaryError] = useState("");

  // Form states - Exit Employee
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));
  const [exitBusy, setExitBusy] = useState(false);
  const [exitError, setExitError] = useState("");

  // Form states - Prepare Run
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState("");

  // Load session context
  const loadContext = useCallback(async () => {
    try {
      const meRes = await fetch(`${api}/auth/me`, { credentials: "include" });
      if (meRes.status === 401) {
        router.replace("/login");
        return;
      }
      const orgsRes = await fetch(`${api}/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgList = await orgsRes.json();
        const activeOrgEntry = orgList.find(
          (o: { organisation: { id: string; name: string } | null; role: { name: string } }) =>
            o.organisation,
        );
        if (activeOrgEntry?.organisation) {
          setOrgName(activeOrgEntry.organisation.name);
          setUserRole(activeOrgEntry.role?.name || "HR");
        }
        setOrganisations(
          orgList
            .map((o: { organisation: { id: string; name: string; businessType?: string } }) => o.organisation)
            .filter(Boolean),
        );
      }
    } catch {
      // ignore
    }
  }, [api, router]);

  // Load people for employee selection
  const loadPeople = useCallback(async () => {
    try {
      const res = await fetch(`${api}/people?limit=100`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPeople(data.items || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  // Load Employees
  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${api}/payroll/employees`, { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load employees.");
      const data = await res.json();
      setEmployees(data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, router]);

  // Load Payroll Runs
  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch(`${api}/payroll/runs`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRuns(data || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  useEffect(() => {
    loadContext();
    loadPeople();
  }, [loadContext, loadPeople]);

  useEffect(() => {
    if (activeTab === "employees") {
      loadEmployees();
    } else {
      loadRuns();
    }
  }, [activeTab, loadEmployees, loadRuns]);

  const activeEmployees = employees.filter((e) => e.status === "ACTIVE");
  const totalMonthlyPayrollMinor = activeEmployees.reduce((acc, e) => {
    const latestSalary = e.salaryStructures?.[0];
    if (!latestSalary) return acc;
    const gross =
      latestSalary.basicSalaryMinor + latestSalary.hraMinor + latestSalary.allowancesMinor;
    return acc + (gross - latestSalary.deductionsMinor);
  }, 0);

  const enrolledPersonIds = new Set(employees.map((e) => e.personId));
  const availablePeople = people.filter((p) => !enrolledPersonIds.has(p.id));
  const employeeContacts = availablePeople.filter((p) =>
    p.types?.some((t) => t.type === "EMPLOYEE" || t.type === "STAFF")
  );
  const otherContacts = availablePeople.filter(
    (p) => !p.types?.some((t) => t.type === "EMPLOYEE" || t.type === "STAFF")
  );

  function openAddEmployeeModal() {
    const nextNum = employees.length + 1;
    const seqCode = `EMP-${String(nextNum).padStart(2, "0")}`;
    setFormCode(seqCode);
    setFormPersonId("");
    setFormDept("Operations");
    setFormDesig("Associate");
    setFormJoiningDate(new Date().toISOString().slice(0, 10));
    setEmpError("");
    setAddEmployeeOpen(true);
  }

  async function handleAddEmployee(e: FormEvent) {
    e.preventDefault();
    if (!formPersonId) {
      setEmpError("Please select a person from directory.");
      return;
    }
    setEmpBusy(true);
    setEmpError("");
    try {
      const res = await fetch(`${api}/payroll/employees`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personId: formPersonId,
          employeeCode: formCode,
          department: formDept || undefined,
          designation: formDesig || undefined,
          joiningDate: new Date(formJoiningDate).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.message || "Failed to create employee.";
        if (data.fields && typeof data.fields === "object") {
          const fieldMsgs = Object.entries(data.fields)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : errs}`)
            .join("; ");
          if (fieldMsgs) errMsg = `${errMsg} (${fieldMsgs})`;
        }
        throw new Error(errMsg);
      }
      setAddEmployeeOpen(false);
      loadEmployees();
      showToast(`Employee ${formCode} enrolled into payroll successfully!`, "success");
    } catch (err) {
      setEmpError((err as Error).message);
    } finally {
      setEmpBusy(false);
    }
  }

  async function handleSetSalary(e: FormEvent) {
    e.preventDefault();
    if (!selectedEmployee) return;
    setSalaryBusy(true);
    setSalaryError("");
    try {
      const bPay = parseFloat(basicPay) || 0;
      const hPay = parseFloat(hra) || 0;
      const aPay = parseFloat(allowances) || 0;
      const dPay = parseFloat(deductions) || 0;

      const res = await fetch(`${api}/payroll/employees/${selectedEmployee.id}/salary-structures`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          basicSalaryMinor: Math.round(bPay * 100),
          hraMinor: Math.round(hPay * 100),
          allowancesMinor: Math.round(aPay * 100),
          deductionsMinor: Math.round(dPay * 100),
          effectiveFrom: new Date(effectiveDate).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to set salary structure.");
      setSalaryModalOpen(false);
      loadEmployees();
      showToast(`Salary structure saved for ${selectedEmployee.person.displayName}!`, "success");
    } catch (err) {
      setSalaryError((err as Error).message);
    } finally {
      setSalaryBusy(false);
    }
  }

  async function handleExitEmployee(e: FormEvent) {
    e.preventDefault();
    if (!selectedEmployee) return;
    setExitBusy(true);
    setExitError("");
    try {
      const res = await fetch(`${api}/payroll/employees/${selectedEmployee.id}/exit`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exitDate: new Date(exitDate).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to record exit.");
      setExitModalOpen(false);
      loadEmployees();
      showToast(`Employee exit recorded.`, "success");
    } catch (err) {
      setExitError((err as Error).message);
    } finally {
      setExitBusy(false);
    }
  }

  async function handlePrepareRun(e: FormEvent) {
    e.preventDefault();
    setRunBusy(true);
    setRunError("");
    try {
      const res = await fetch(`${api}/payroll/runs`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          year: Number(runYear),
          month: Number(runMonth),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to prepare payroll run.");
      setPrepareRunOpen(false);
      loadRuns();
      setDetailRun(data);
      showToast(`Payroll batch generated for ${MONTH_NAMES[runMonth - 1]} ${runYear}!`, "success");
    } catch (err) {
      setRunError((err as Error).message);
    } finally {
      setRunBusy(false);
    }
  }

  async function handleApproveRun(runId: string) {
    try {
      const res = await fetch(`${api}/payroll/runs/${runId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const updated = await res.json();
        setDetailRun(updated);
        loadRuns();
        showToast("Payroll batch approved successfully!", "success");
      }
    } catch {
      // ignore
    }
  }

  async function handleMarkPaid(runId: string) {
    try {
      const res = await fetch(`${api}/payroll/runs/${runId}/pay`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentReference: `PAY-DISB-${Date.now()}` }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDetailRun(updated);
        loadRuns();
        showToast("Payroll batch marked as paid & disbursed!", "success");
      }
    } catch {
      // ignore
    }
  }

  const tabItems = [
    { id: "employees", label: "Staff Salaries & Packages", count: employees.length },
    { id: "runs", label: "Monthly Salary Runs", count: runs.length },
  ];

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/payroll"
      nav={nav}
      userName={userName}
      userRole={userRole}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="payroll" size={14} /> HR & Staff Compensation
          </p>
          <h1>Staff Salaries & Payroll</h1>
          <p className="subheading">
            Manage employee monthly salary packages, advance deductions, payslips, and monthly salary disbursement.
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPrepareRunOpen(true)}
          >
            <Icon name="calendar" size={15} />
            <span>Prepare Monthly Salary Run</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => openAddEmployeeModal()}
          >
            <Icon name="plus" size={15} />
            <span>+ Add Staff / Employee</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="stats-grid">
        <StatCard
          label="Active Staff"
          value={activeEmployees.length}
          change="On active salary payroll"
          icon="people"
          tone="blue"
        />
        <StatCard
          label="Monthly Salary Payout"
          value={formatMoney(totalMonthlyPayrollMinor)}
          change="Estimated net payout"
          icon="payroll"
          tone="teal"
        />
        <StatCard
          label="Salary Runs"
          value={runs.length}
          change="Disbursed batches"
          icon="calendar"
          tone="amber"
        />
        <StatCard
          label="Compliance Ready"
          value="100%"
          change="Taxes & PF tracked"
          icon="checkCircle"
          tone="purple"
        />
      </div>

      <Tabs
        items={tabItems}
        active={activeTab}
        onChange={(id) => setActiveTab(id as "employees" | "runs")}
      />

      {/* Employees Tab */}
      {activeTab === "employees" && (
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">
              <div className="state-spinner" />
              <p>Loading employees…</p>
            </div>
          ) : employees.length === 0 ? (
            <EmptyState
              icon="payroll"
              title="No employees registered yet"
              description="Add staff members from your People directory and configure their salary packages."
              actionLabel="Add Employee"
              onAction={() => setAddEmployeeOpen(true)}
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Code</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Monthly Compensation</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const salary = emp.salaryStructures?.[0];
                  const grossMinor = salary
                    ? salary.basicSalaryMinor + salary.hraMinor + salary.allowancesMinor
                    : 0;
                  const netMinor = salary ? grossMinor - salary.deductionsMinor : 0;

                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className="table-primary-cell">
                          <div className="table-avatar">
                            {emp.person?.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong>{emp.person?.displayName}</strong>
                            <small style={{ color: "var(--muted)", display: "block" }}>
                              Joined {new Date(emp.joiningDate).toLocaleDateString()}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code>{emp.employeeCode}</code>
                      </td>
                      <td>{emp.department || "General"}</td>
                      <td>{emp.designation || "Staff"}</td>
                      <td>
                        {salary ? (
                          <div>
                            <strong>{formatMoney(netMinor)} / mo</strong>
                            <small style={{ color: "var(--muted)", display: "block" }}>
                              Gross: {formatMoney(grossMinor)}
                            </small>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>No salary set</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={emp.status === "ACTIVE" ? "green" : "red"}>
                          {emp.status}
                        </Badge>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="table-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedEmployee(emp);
                              if (salary) {
                                setBasicPay((salary.basicSalaryMinor / 100).toString());
                                setHra((salary.hraMinor / 100).toString());
                                setAllowances((salary.allowancesMinor / 100).toString());
                                setDeductions((salary.deductionsMinor / 100).toString());
                              } else {
                                setBasicPay("30000");
                                setHra("12000");
                                setAllowances("5000");
                                setDeductions("2000");
                              }
                              setSalaryModalOpen(true);
                            }}
                          >
                            <Icon name="rupee" size={13} />
                            <span>Salary</span>
                          </button>
                          {emp.status === "ACTIVE" && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setSelectedEmployee(emp);
                                setExitModalOpen(true);
                              }}
                            >
                              <span>Exit</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payroll Runs Tab */}
      {activeTab === "runs" && (
        <div className="table-wrap">
          {runs.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No payroll runs executed"
              description="Prepare your first monthly payroll batch to calculate employee disbursements."
              actionLabel="Prepare Monthly Run"
              onAction={() => setPrepareRunOpen(true)}
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Employees</th>
                  <th>Total Gross</th>
                  <th>Deductions</th>
                  <th>Net Payout</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="clickable"
                    onClick={() => setDetailRun(run)}
                  >
                    <td>
                      <strong>
                        {MONTH_NAMES[run.month - 1]} {run.year}
                      </strong>
                    </td>
                    <td>
                      <Badge
                        tone={
                          run.status === "PAID"
                            ? "green"
                            : run.status === "APPROVED"
                              ? "blue"
                              : "amber"
                        }
                      >
                        {run.status}
                      </Badge>
                    </td>
                    <td>{run.items?.length || 0}</td>
                    <td>{formatMoney(run.totalGrossMinor)}</td>
                    <td>{formatMoney(run.totalDeductionsMinor)}</td>
                    <td>
                      <strong>{formatMoney(run.totalNetMinor)}</strong>
                    </td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setDetailRun(run)}
                      >
                        <Icon name="eye" size={14} />
                        <span>View Run</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payroll Run Detail Drawer */}
      <Drawer
        isOpen={Boolean(detailRun)}
        onClose={() => setDetailRun(null)}
        title={
          detailRun
            ? `Payroll: ${MONTH_NAMES[detailRun.month - 1]} ${detailRun.year}`
            : "Payroll Run"
        }
        subtitle="Employee Compensation Disbursement"
        width={560}
      >
        {detailRun && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Totals & Status Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 16,
                background: "#f8fafc",
                borderRadius: 12,
                border: "1px solid var(--line)",
              }}
            >
              <div>
                <small style={{ color: "var(--muted)", fontSize: 11 }}>Total Net Payout</small>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--brand)" }}>
                  {formatMoney(detailRun.totalNetMinor)}
                </div>
                <small style={{ color: "var(--muted)" }}>
                  Gross: {formatMoney(detailRun.totalGrossMinor)} · Deductions:{" "}
                  {formatMoney(detailRun.totalDeductionsMinor)}
                </small>
              </div>
              <Badge
                tone={
                  detailRun.status === "PAID"
                    ? "green"
                    : detailRun.status === "APPROVED"
                      ? "blue"
                      : "amber"
                }
              >
                {detailRun.status}
              </Badge>
            </div>

            {/* Run Actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {detailRun.status === "DRAFT" && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleApproveRun(detailRun.id)}
                >
                  <Icon name="check" size={14} />
                  <span>Approve Payroll Run</span>
                </button>
              )}
              {detailRun.status === "APPROVED" && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleMarkPaid(detailRun.id)}
                >
                  <Icon name="rupee" size={14} />
                  <span>Mark as Paid & Disbursed</span>
                </button>
              )}
            </div>

            {/* Itemized Employee Payouts */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block" }}>
                Staff Disbursement List ({detailRun.items?.length || 0})
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detailRun.items?.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: "#fff",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <strong>{item.employee.person.displayName}</strong>
                      <small style={{ color: "var(--muted)", display: "block" }}>
                        Code: {item.employee.employeeCode} · Basic: {formatMoney(item.basicSalaryMinor)}
                      </small>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ fontSize: 14 }}>
                        {formatMoney(item.netPayableMinor)}
                      </strong>
                      <div style={{ marginTop: 4 }}>
                        <a
                          href={`${api}/payroll/runs/${detailRun.id}/items/${item.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "2px 8px", fontSize: 11 }}
                        >
                          <Icon name="download" size={12} />
                          <span>Payslip</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Add Employee Modal */}
      <Modal
        isOpen={addEmployeeOpen}
        onClose={() => setAddEmployeeOpen(false)}
        title="Add Staff Member"
        subtitle="Enrol team member into active employee payroll"
        maxWidth={480}
      >
        <form onSubmit={handleAddEmployee} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {empError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {empError}
            </div>
          )}

          <div className="form-group">
            <label>Person from Directory *</label>
            <select
              className="filter-select"
              value={formPersonId}
              onChange={(e) => setFormPersonId(e.target.value)}
              required
            >
              <option value="">-- Select person from directory --</option>
              {employeeContacts.length > 0 && (
                <optgroup label="💼 Staff & Employees in Directory (Recommended)">
                  {employeeContacts.map((p) => {
                    const typeLabels = p.types?.map((t) => t.type).join(", ");
                    return (
                      <option key={p.id} value={p.id}>
                        {p.displayName} {typeLabels ? `[${typeLabels}]` : ""} {p.email ? `(${p.email})` : ""}
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {otherContacts.length > 0 && (
                <optgroup label="👥 Other Directory Contacts (Students, Customers, Leads)">
                  {otherContacts.map((p) => {
                    const typeLabels = p.types?.map((t) => t.type).join(", ");
                    return (
                      <option key={p.id} value={p.id}>
                        {p.displayName} {typeLabels ? `[${typeLabels}]` : ""} {p.email ? `(${p.email})` : ""}
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {availablePeople.length === 0 && (
                <option disabled value="">
                  No eligible contacts available (all directory contacts already enrolled)
                </option>
              )}
            </select>
            <p style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
              💡 <em>To add a new employee profile, you can also create them in <a href="/people" style={{ color: "#2563eb", textDecoration: "underline" }}>People Directory</a> with Person Type: <strong>Employee</strong>.</em>
            </p>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Employee Code *</label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. EMP-01"
                required
              />
            </div>
            <div className="form-group">
              <label>Joining Date *</label>
              <input
                type="date"
                value={formJoiningDate}
                onChange={(e) => setFormJoiningDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                placeholder="e.g. Operations, Sales, Teaching"
                value={formDept}
                onChange={(e) => setFormDept(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Designation</label>
              <input
                type="text"
                placeholder="e.g. Senior Executive, Teacher"
                value={formDesig}
                onChange={(e) => setFormDesig(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAddEmployeeOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={empBusy}>
              {empBusy ? "Saving…" : "Save Employee"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Set Salary Structure Modal */}
      <Modal
        isOpen={salaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        title="Configure Salary Structure"
        subtitle={selectedEmployee?.person?.displayName || "Employee"}
        maxWidth={460}
      >
        <form onSubmit={handleSetSalary} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {salaryError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {salaryError}
            </div>
          )}

          {/* 1-Click Salary Package Presets */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 750, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              ⚡ 1-Click Salary Templates:
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {[
                { label: "Junior / Intern (₹15k)", basic: "10000", hra: "3000", allowances: "2000", ded: "0" },
                { label: "Associate / Staff (₹25k)", basic: "16000", hra: "6000", allowances: "4000", ded: "1000" },
                { label: "Senior / Faculty (₹45k)", basic: "28000", hra: "11000", allowances: "8000", ded: "2000" },
                { label: "Manager / Lead (₹65k)", basic: "40000", hra: "16000", allowances: "12000", ded: "3000" },
              ].map((pkg) => (
                <button
                  key={pkg.label}
                  type="button"
                  onClick={() => {
                    setBasicPay(pkg.basic);
                    setHra(pkg.hra);
                    setAllowances(pkg.allowances);
                    setDeductions(pkg.ded);
                  }}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#1e3a8a",
                    fontSize: 11,
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  {pkg.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Basic Salary (₹/mo) *</label>
              <input
                type="number"
                placeholder="e.g. 35000"
                value={basicPay}
                onChange={(e) => setBasicPay(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>HRA (₹/mo)</label>
              <input
                type="number"
                placeholder="e.g. 14000"
                value={hra}
                onChange={(e) => setHra(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Other Allowances (₹/mo)</label>
              <input
                type="number"
                placeholder="e.g. 6000"
                value={allowances}
                onChange={(e) => setAllowances(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>PF / Tax Deductions (₹/mo)</label>
              <input
                type="number"
                placeholder="e.g. 3000"
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
              <label style={{ margin: 0 }}>Effective Date *</label>
              <button
                type="button"
                onClick={() => setEffectiveDate(new Date().toISOString().split("T")[0] || "")}
                style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", color: "var(--brand)" }}
              >
                Today
              </button>
            </div>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
            />
          </div>

          {/* Salary Preview */}
          <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 8, fontSize: 12 }}>
            <div>
              Gross Monthly: ₹
              {(
                (parseFloat(basicPay) || 0) +
                (parseFloat(hra) || 0) +
                (parseFloat(allowances) || 0)
              ).toLocaleString("en-IN")}
            </div>
            <div style={{ fontWeight: 700, marginTop: 2 }}>
              Net Payable: ₹
              {(
                (parseFloat(basicPay) || 0) +
                (parseFloat(hra) || 0) +
                (parseFloat(allowances) || 0) -
                (parseFloat(deductions) || 0)
              ).toLocaleString("en-IN")}
            </div>
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSalaryModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={salaryBusy}>
              {salaryBusy ? "Saving…" : "Save Package"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Exit Employee Modal */}
      <Modal
        isOpen={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
        title="Record Employee Exit"
        subtitle={selectedEmployee?.person?.displayName || "Employee"}
        maxWidth={400}
      >
        <form onSubmit={handleExitEmployee} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {exitError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {exitError}
            </div>
          )}

          <div className="form-group">
            <label>Official Exit Date *</label>
            <input
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setExitModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={exitBusy}>
              {exitBusy ? "Saving…" : "Confirm Exit"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Prepare Payroll Run Modal */}
      <Modal
        isOpen={prepareRunOpen}
        onClose={() => setPrepareRunOpen(false)}
        title="Prepare Monthly Payroll"
        subtitle="Calculate payouts for all active staff"
        maxWidth={420}
      >
        <form onSubmit={handlePrepareRun} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {runError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {runError}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>Year *</label>
              <input
                type="number"
                value={runYear}
                onChange={(e) => setRunYear(Number(e.target.value))}
                required
              />
            </div>
            <div className="form-group">
              <label>Month *</label>
              <select
                className="filter-select"
                value={runMonth}
                onChange={(e) => setRunMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPrepareRunOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={runBusy}>
              {runBusy ? "Calculating…" : "Generate Batch"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast Notification Feedback Card */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 18px",
            borderRadius: 12,
            background: toast.type === "success" ? "#0f172a" : "#991b1b",
            color: "#ffffff",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
            fontSize: 13.5,
            fontWeight: 600,
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#fff",
              borderRadius: 6,
              padding: "3px 8px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 750,
              marginLeft: 8,
            }}
          >
            OK
          </button>
        </div>
      )}
    </AppShell>
  );
}
