"use client";

import {
  AppShell,
  Badge,
  Drawer,
  EmptyState,
  Icon,
  Modal,
  StatCard,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";

const nav: NavItem[] = [
  { label: "Dashboard", icon: "home", href: "/" },
  { label: "Students & Attendance", icon: "student", href: "/students" },
  { label: "People & Directory", icon: "people", href: "/people" },
  { label: "Leads & CRM", icon: "crm", href: "/crm" },
  { label: "Finance & Fees", icon: "finance", href: "/finance" },
  { label: "Staff & Salary", icon: "payroll", href: "/payroll" },
  { label: "Inventory & Stock", icon: "inventory", href: "/inventory" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

type StudentProfile = {
  id: string;
  organisationId: string;
  personId: string;
  rollNumber: string | null;
  standard: string;
  batch: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianRelation: string | null;
  feeFrequency: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  feeAmountMinor: number;
  billingStartDate: string;
  status: "ACTIVE" | "INACTIVE";
  admissionDate: string;
  createdAt: string;
  person: {
    id: string;
    displayName: string;
    primaryPhone: string | null;
    alternatePhone: string | null;
    email: string | null;
    address?: { street?: string; city?: string; state?: string; postalCode?: string } | null;
    status: string;
  };
};

type RecurringFeeItem = {
  studentProfileId: string;
  personId: string;
  displayName: string;
  rollNumber: string | null;
  standard: string;
  batch: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  feeFrequency: string;
  feePlanAmountMinor: number;
  cycleMonth: string;
  cycleMonthLabel: string;
  status: "PAID" | "PARTIALLY_PAID" | "PENDING";
  paidMinor: number;
  balanceMinor: number;
  invoiceId: string | null;
  invoiceNumber: string | null;
  lastPaymentDate: string | null;
};

type AttendanceItem = {
  studentProfileId: string;
  personId: string;
  displayName: string;
  rollNumber: string | null;
  standard: string;
  batch: string | null;
  primaryPhone: string | null;
  status: "PRESENT" | "ABSENT" | "LEAVE";
  remarks: string;
  recordedAt: string | null;
};

type MonthlyAttendanceSummary = {
  studentProfileId: string;
  displayName: string;
  rollNumber: string | null;
  standard: string;
  batch: string | null;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  percentage: number;
};

function formatMoney(minor: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function StudentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = getApiUrl();

  // Active Tab: "directory" | "recurring-fees" | "attendance" | "summary"
  const [activeTab, setActiveTab] = useState<string>("directory");

  // Context & AppShell info
  const [orgName, setOrgName] = useState("CRMKaro Workspace");
  const [userName, setUserName] = useState("Admin");
  const [userRole, setUserRole] = useState("Administrator");
  const [currency, setCurrency] = useState("INR");
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);

  // Students Directory State
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [standardFilter, setStandardFilter] = useState("ALL");
  const [batchFilter, setBatchFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");

  // Recurring Fees State
  const todayYyyyMm = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(todayYyyyMm);
  const [recurringFeesData, setRecurringFeesData] = useState<{
    cycleMonth: string;
    cycleMonthLabel: string;
    totalExpectedMinor: number;
    totalCollectedMinor: number;
    totalPendingMinor: number;
    studentsCount: number;
    paidCount: number;
    pendingCount: number;
    items: RecurringFeeItem[];
  } | null>(null);
  const [loadingFees, setLoadingFees] = useState(false);

  // Daily Attendance Grid State
  const todayYyyyMmDd = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayYyyyMmDd);
  const [attendanceData, setAttendanceData] = useState<{
    date: string;
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    attendancePercentage: number;
    items: AttendanceItem[];
  } | null>(null);
  const [attendanceEdits, setAttendanceEdits] = useState<Record<string, { status: "PRESENT" | "ABSENT" | "LEAVE"; remarks: string }>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Monthly Attendance Summary State
  const [attendanceSummary, setAttendanceSummary] = useState<{
    month: string;
    monthLabel: string;
    totalWorkingDays: number;
    students: MonthlyAttendanceSummary[];
  } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Modals & Drawers
  const [admissionModalOpen, setAdmissionModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [studentDetailFull, setStudentDetailFull] = useState<any>(null);

  // Fee Collection Modal
  const [collectFeeModalOpen, setCollectFeeModalOpen] = useState(false);
  const [collectFeeStudent, setCollectFeeStudent] = useState<RecurringFeeItem | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMethod, setCollectMethod] = useState("UPI");
  const [collectReference, setCollectReference] = useState("");
  const [collectNotes, setCollectNotes] = useState("");
  const [collectingFee, setCollectingFee] = useState(false);
  const [receiptSuccessData, setReceiptSuccessData] = useState<{
    receiptNumber: string;
    monthLabel: string;
    whatsappUrl: string | null;
    invoiceId: string;
  } | null>(null);

  // Admission Form State
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAltPhone, setFormAltPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formRollNumber, setFormRollNumber] = useState("");
  const [formStandard, setFormStandard] = useState("10th Standard");
  const [formBatch, setFormBatch] = useState("Morning Batch");
  const [formGuardianName, setFormGuardianName] = useState("");
  const [formGuardianPhone, setFormGuardianPhone] = useState("");
  const [formGuardianRelation, setFormGuardianRelation] = useState("Father");
  const [formFeeFrequency, setFormFeeFrequency] = useState<"MONTHLY" | "QUARTERLY" | "ANNUAL">("MONTHLY");
  const [formFeeAmount, setFormFeeAmount] = useState("500");
  const [formAdmissionDate, setFormAdmissionDate] = useState(todayYyyyMmDd);
  const [formNotes, setFormNotes] = useState("");
  const [admissionBusy, setAdmissionBusy] = useState(false);
  const [admissionError, setAdmissionError] = useState("");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load context
  const loadContext = useCallback(async () => {
    try {
      const meRes = await authFetch(`${api}/auth/me`, { credentials: "include" });
      if (meRes.status === 401) {
        router.replace("/login");
        return;
      }
      const orgsRes = await authFetch(`${api}/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgList = await orgsRes.json();
        const activeOrgEntry = orgList.find(
          (o: { organisation: { id: string; name: string } | null; role: { name: string } }) =>
            o.organisation,
        );
        if (activeOrgEntry?.organisation) {
          setOrgName(activeOrgEntry.organisation.name);
          setUserRole(activeOrgEntry.role?.name || "Admin");
          setCurrency(activeOrgEntry.organisation.currency || "INR");
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

  // Load Students list
  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      let url = `${api}/students?limit=200`;
      if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
      if (standardFilter !== "ALL") url += `&standard=${encodeURIComponent(standardFilter)}`;
      if (batchFilter !== "ALL") url += `&batch=${encodeURIComponent(batchFilter)}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await authFetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.items || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStudents(false);
    }
  }, [api, statusFilter, standardFilter, batchFilter, searchQuery]);

  // Load Recurring Fees
  const loadRecurringFees = useCallback(async () => {
    setLoadingFees(true);
    try {
      const res = await authFetch(`${api}/students/recurring-fees?month=${selectedMonth}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setRecurringFeesData(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingFees(false);
    }
  }, [api, selectedMonth]);

  // Load Attendance
  const loadAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    try {
      let url = `${api}/students/attendance?date=${selectedDate}`;
      if (standardFilter !== "ALL") url += `&standard=${encodeURIComponent(standardFilter)}`;
      if (batchFilter !== "ALL") url += `&batch=${encodeURIComponent(batchFilter)}`;

      const res = await authFetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAttendanceData(data);
        const edits: Record<string, { status: "PRESENT" | "ABSENT" | "LEAVE"; remarks: string }> = {};
        for (const item of data.items || []) {
          edits[item.studentProfileId] = { status: item.status, remarks: item.remarks || "" };
        }
        setAttendanceEdits(edits);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAttendance(false);
    }
  }, [api, selectedDate, standardFilter, batchFilter]);

  // Load Monthly Summary
  const loadMonthlySummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await authFetch(`${api}/students/attendance/summary?month=${selectedMonth}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAttendanceSummary(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSummary(false);
    }
  }, [api, selectedMonth]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (activeTab === "directory") {
      loadStudents();
    } else if (activeTab === "recurring-fees") {
      loadRecurringFees();
    } else if (activeTab === "attendance") {
      loadAttendance();
    } else if (activeTab === "summary") {
      loadMonthlySummary();
    }
  }, [activeTab, loadStudents, loadRecurringFees, loadAttendance, loadMonthlySummary]);

  // Handle URL action
  useEffect(() => {
    const action = searchParams?.get("action");
    if (action === "new-admission") {
      setAdmissionModalOpen(true);
    }
  }, [searchParams]);

  // Fetch full student profile for drawer
  async function handleOpenDetail(student: StudentProfile) {
    setSelectedStudent(student);
    setDetailDrawerOpen(true);
    try {
      const res = await authFetch(`${api}/students/${student.id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStudentDetailFull(data);
      }
    } catch {
      // ignore
    }
  }

  // Handle Admission Submit
  async function handleSaveAdmission(e: FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      setAdmissionError("Please enter student full name.");
      return;
    }
    if (!formStandard.trim()) {
      setAdmissionError("Please enter class or standard.");
      return;
    }
    setAdmissionBusy(true);
    setAdmissionError("");
    try {
      const payload = {
        displayName: formName.trim(),
        primaryPhone: formPhone.trim() || undefined,
        alternatePhone: formAltPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        address: formStreet || formCity || formState ? { street: formStreet, city: formCity, state: formState } : undefined,
        rollNumber: formRollNumber.trim() || undefined,
        standard: formStandard.trim(),
        batch: formBatch.trim() || undefined,
        guardianName: formGuardianName.trim() || undefined,
        guardianPhone: formGuardianPhone.trim() || undefined,
        guardianRelation: formGuardianRelation.trim() || undefined,
        feeFrequency: formFeeFrequency,
        feeAmountMinor: Math.round(Number(formFeeAmount) * 100) || 0,
        admissionDate: formAdmissionDate,
        billingStartDate: formAdmissionDate,
        notes: formNotes.trim() || undefined,
      };

      const res = await authFetch(`${api}/students`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create student admission.");
      }

      setAdmissionModalOpen(false);
      resetAdmissionForm();
      loadStudents();
      loadRecurringFees();
      showToast(`Student ${data.person?.displayName || formName} admitted successfully!`, "success");
    } catch (err) {
      setAdmissionError((err as Error).message);
    } finally {
      setAdmissionBusy(false);
    }
  }

  function resetAdmissionForm() {
    setFormName("");
    setFormPhone("");
    setFormAltPhone("");
    setFormEmail("");
    setFormStreet("");
    setFormCity("");
    setFormState("");
    setFormRollNumber("");
    setFormStandard("10th Standard");
    setFormBatch("Morning Batch");
    setFormGuardianName("");
    setFormGuardianPhone("");
    setFormGuardianRelation("Father");
    setFormFeeFrequency("MONTHLY");
    setFormFeeAmount("500");
    setFormAdmissionDate(todayYyyyMmDd);
    setFormNotes("");
    setAdmissionError("");
  }

  // Handle Status Toggle (Active / Inactive)
  async function handleToggleStatus(studentId: string, currentStatus: "ACTIVE" | "INACTIVE") {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const confirmMsg =
      currentStatus === "ACTIVE"
        ? "Deactivate this student? Future recurring fees will pause and student will be hidden from daily attendance."
        : "Reactivate this student? Student will re-appear in active roll and attendance.";
    if (!confirm(confirmMsg)) return;

    try {
      const res = await authFetch(`${api}/students/${studentId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        showToast(`Student marked as ${nextStatus}!`, "success");
        loadStudents();
        loadRecurringFees();
        if (detailDrawerOpen && selectedStudent?.id === studentId) {
          setSelectedStudent((prev) => (prev ? { ...prev, status: nextStatus } : null));
        }
      }
    } catch {
      showToast("Failed to update student status.", "error");
    }
  }

  // 1-Click Fee Collection Modal Open
  function openCollectFeeModal(item: RecurringFeeItem) {
    setCollectFeeStudent(item);
    setCollectAmount((item.balanceMinor > 0 ? item.balanceMinor / 100 : item.feePlanAmountMinor / 100).toString());
    setCollectMethod("UPI");
    setCollectReference("");
    setCollectNotes("");
    setReceiptSuccessData(null);
    setCollectFeeModalOpen(true);
  }

  // Handle Fee Collection Submit
  async function handleSaveCollectFee(e: FormEvent) {
    e.preventDefault();
    if (!collectFeeStudent) return;
    const amountNum = Number(collectAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    setCollectingFee(true);
    try {
      const payload = {
        studentProfileId: collectFeeStudent.studentProfileId,
        month: collectFeeStudent.cycleMonth,
        amountMinor: Math.round(amountNum * 100),
        paymentMethod: collectMethod,
        reference: collectReference.trim() || undefined,
        notes: collectNotes.trim() || undefined,
      };

      const res = await authFetch(`${api}/students/collect-fee`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to collect fee.");
      }

      setReceiptSuccessData({
        receiptNumber: data.receiptNumber,
        monthLabel: data.monthLabel,
        whatsappUrl: data.whatsappUrl,
        invoiceId: data.invoice?.id,
      });

      loadRecurringFees();
      showToast(`Fee of ₹${amountNum} collected successfully!`, "success");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCollectingFee(false);
    }
  }

  // Attendance fast toggles
  function handleToggleAttendance(studentId: string, status: "PRESENT" | "ABSENT" | "LEAVE") {
    setAttendanceEdits((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        remarks: prev[studentId]?.remarks || "",
      },
    }));
  }

  function handleMarkAllPresent() {
    if (!attendanceData?.items) return;
    const edits: Record<string, { status: "PRESENT" | "ABSENT" | "LEAVE"; remarks: string }> = {};
    for (const it of attendanceData.items) {
      edits[it.studentProfileId] = { status: "PRESENT", remarks: attendanceEdits[it.studentProfileId]?.remarks || "" };
    }
    setAttendanceEdits(edits);
    showToast("All students marked Present!", "success");
  }

  // Save Attendance Batch
  async function handleSaveAttendance() {
    if (!attendanceData?.items) return;
    setSavingAttendance(true);
    try {
      const records = Object.entries(attendanceEdits).map(([studentProfileId, edit]) => ({
        studentProfileId,
        status: edit.status,
        remarks: edit.remarks?.trim() || undefined,
      }));

      const res = await authFetch(`${api}/students/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          records,
        }),
      });

      if (res.ok) {
        showToast("Daily attendance saved successfully!", "success");
        loadAttendance();
      } else {
        const err = await res.json();
        alert(err.message || "Failed to save attendance.");
      }
    } catch {
      alert("Error saving attendance.");
    } finally {
      setSavingAttendance(false);
    }
  }

  // Distinct Standards and Batches from loaded students
  const distinctStandards = Array.from(new Set(students.map((s) => s.standard).filter(Boolean)));
  const distinctBatches = Array.from(new Set(students.map((s) => s.batch).filter((b): b is string => Boolean(b))));

  const tabItems = [
    { id: "directory", label: "Student Directory", count: students.length },
    {
      id: "recurring-fees",
      label: "Recurring Fees Cycle",
      count: recurringFeesData?.pendingCount ?? 0,
    },
    { id: "attendance", label: "Daily Attendance Grid" },
    { id: "summary", label: "Monthly Summary Report" },
  ];

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/students"
      nav={nav}
      userName={userName}
      userRole={userRole}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
    >
      {/* Toast Feedback */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 10,
            background: toast.type === "success" ? "#064e3b" : "#7f1d1d",
            color: "#ffffff",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Icon name={toast.type === "success" ? "checkCircle" : "alertCircle"} size={18} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="student" size={14} /> Student Lifecycle, Fees & Attendance
          </p>
          <h1>Students & Academy Management</h1>
          <p className="subheading">
            Manage one-time student admissions, automated recurring monthly fees, and fast daily attendance.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            resetAdmissionForm();
            setAdmissionModalOpen(true);
          }}
        >
          <Icon name="plus" size={16} />
          <span>+ New Admission</span>
        </button>
      </div>

      {/* Quick Summary Metric Cards */}
      <div className="stats-grid">
        <StatCard
          label="Active Students"
          value={students.filter((s) => s.status === "ACTIVE").length.toString()}
          change={`${distinctStandards.length} Standards · ${distinctBatches.length} Batches`}
          icon="student"
          tone="teal"
        />
        <StatCard
          label={`${recurringFeesData?.cycleMonthLabel || "This Month"} Fees Collected`}
          value={formatMoney(recurringFeesData?.totalCollectedMinor || 0, currency)}
          change={`${recurringFeesData?.paidCount || 0} students cleared`}
          icon="finance"
          tone="blue"
        />
        <StatCard
          label="Pending Fee Dues"
          value={formatMoney(recurringFeesData?.totalPendingMinor || 0, currency)}
          change={`${recurringFeesData?.pendingCount || 0} students due`}
          icon="rupee"
          tone="amber"
        />
        <StatCard
          label="Today's Attendance"
          value={`${attendanceData?.attendancePercentage ?? 0}%`}
          change={`${attendanceData?.presentCount ?? 0} Present / ${attendanceData?.totalStudents ?? 0} Total`}
          icon="calendar"
          tone="rose"
        />
      </div>

      {/* Main Tabs Header */}
      <div className="filter-bar" style={{ marginTop: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? "1px solid var(--brand)" : "1px solid var(--line)",
                  background: isActive ? "var(--brand)" : "#ffffff",
                  color: isActive ? "#ffffff" : "var(--ink)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 12,
                      background: isActive ? "rgba(255,255,255,0.25)" : "var(--canvas-subtle)",
                      color: isActive ? "#ffffff" : "var(--muted)",
                      fontWeight: 700,
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: STUDENT ADMISSIONS & DIRECTORY                           */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "directory" && (
        <section className="section-card">
          <div className="section-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3>Student Directory</h3>
              <p>All admitted students, course details, guardian contact, and status.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="🔍 Search name, roll, phone, guardian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  fontSize: 12,
                  width: 220,
                }}
              />
              <select
                value={standardFilter}
                onChange={(e) => setStandardFilter(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12 }}
              >
                <option value="ALL">All Standards</option>
                {distinctStandards.map((std) => (
                  <option key={std} value={std}>
                    {std}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12 }}
              >
                <option value="ACTIVE">Active Students</option>
                <option value="INACTIVE">Inactive / Alumni</option>
                <option value="ALL">All Status</option>
              </select>
            </div>
          </div>

          {loadingStudents ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              Loading student directory…
            </div>
          ) : students.length === 0 ? (
            <EmptyState
              title="No students found"
              description="Admit your first student to begin tracking monthly fee cycles and daily attendance."
              actionLabel="+ New Admission"
              onAction={() => {
                resetAdmissionForm();
                setAdmissionModalOpen(true);
              }}
            />
          ) : (
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Name & Roll</th>
                    <th>Standard & Batch</th>
                    <th>Guardian Contact</th>
                    <th>Fee Plan</th>
                    <th>Admission Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((std) => (
                    <tr
                      key={std.id}
                      style={{ cursor: "pointer", opacity: std.status === "INACTIVE" ? 0.65 : 1 }}
                      onClick={() => handleOpenDetail(std)}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              background: std.status === "ACTIVE" ? "#0f766e" : "#64748b",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {std.person.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ fontSize: 13 }}>{std.person.displayName}</strong>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              {std.rollNumber ? `#${std.rollNumber}` : "No Roll #"} · {std.person.primaryPhone || "No Phone"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{std.standard}</strong>
                        {std.batch && <div style={{ fontSize: 11, color: "var(--muted)" }}>{std.batch}</div>}
                      </td>
                      <td>
                        <div>{std.guardianName || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {std.guardianRelation ? `(${std.guardianRelation}) ` : ""}
                          {std.guardianPhone || "—"}
                        </div>
                      </td>
                      <td>
                        <strong>{formatMoney(std.feeAmountMinor, currency)}</strong>
                        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "lowercase" }}>
                          /{std.feeFrequency}
                        </div>
                      </td>
                      <td>
                        <time style={{ fontSize: 12, color: "var(--muted)" }}>
                          {new Date(std.admissionDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </time>
                      </td>
                      <td>
                        <Badge tone={std.status === "ACTIVE" ? "green" : "neutral"}>
                          {std.status}
                        </Badge>
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          <button
                            className="secondary-button"
                            style={{ padding: "4px 8px", fontSize: 11 }}
                            onClick={() => handleOpenDetail(std)}
                          >
                            View
                          </button>
                          <button
                            className="secondary-button"
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              color: std.status === "ACTIVE" ? "#b91c1c" : "#047857",
                            }}
                            onClick={() => handleToggleStatus(std.id, std.status)}
                          >
                            {std.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: AUTOMATED RECURRING FEES CYCLE (ROLLING DASHBOARD)       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "recurring-fees" && (
        <section className="section-card">
          <div className="section-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3>Automated Monthly Fee Cycle & Rolling Collection</h3>
              <p>
                No manual invoice creation needed every month. System rolls dues automatically. 1-click Collect marks fees paid and advances cycle!
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Cycle Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--brand)",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          {/* Rolling Fee Progress Bar */}
          {recurringFeesData && (
            <div
              style={{
                padding: "16px 20px",
                background: "var(--canvas-subtle)",
                borderRadius: 10,
                marginBottom: 20,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  Expected Fee
                </span>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginTop: 2 }}>
                  {formatMoney(recurringFeesData.totalExpectedMinor, currency)}
                </div>
                <small style={{ color: "var(--muted)" }}>{recurringFeesData.studentsCount} Active students enrolled</small>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "#047857", textTransform: "uppercase", fontWeight: 700 }}>
                  Collected Revenue
                </span>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#047857", marginTop: 2 }}>
                  {formatMoney(recurringFeesData.totalCollectedMinor, currency)}
                </div>
                <small style={{ color: "#047857" }}>{recurringFeesData.paidCount} students cleared</small>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "#b45309", textTransform: "uppercase", fontWeight: 700 }}>
                  Pending Dues
                </span>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#b45309", marginTop: 2 }}>
                  {formatMoney(recurringFeesData.totalPendingMinor, currency)}
                </div>
                <small style={{ color: "#b45309" }}>{recurringFeesData.pendingCount} students pending</small>
              </div>
            </div>
          )}

          {loadingFees ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              Loading fee cycle dues…
            </div>
          ) : !recurringFeesData?.items?.length ? (
            <EmptyState
              title="No active fee cycles"
              description="No active students enrolled for this billing cycle."
            />
          ) : (
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th>Standard & Batch</th>
                    <th>Guardian / Contact</th>
                    <th>Monthly Plan</th>
                    <th>Fee Status</th>
                    <th>Paid Amount</th>
                    <th>Balance Due</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringFeesData.items.map((item) => (
                    <tr key={item.studentProfileId}>
                      <td>
                        <strong>{item.displayName}</strong>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {item.rollNumber ? `#${item.rollNumber}` : ""} · {item.cycleMonthLabel}
                        </div>
                      </td>
                      <td>
                        <div>{item.standard}</div>
                        {item.batch && <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.batch}</div>}
                      </td>
                      <td>
                        <div>{item.guardianName || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.guardianPhone || "—"}</div>
                      </td>
                      <td>
                        <strong>{formatMoney(item.feePlanAmountMinor, currency)}</strong>
                      </td>
                      <td>
                        <Badge
                          tone={
                            item.status === "PAID"
                              ? "green"
                              : item.status === "PARTIALLY_PAID"
                                ? "amber"
                                : "red"
                          }
                        >
                          {item.status === "PAID"
                            ? "PAID / CLEARED"
                            : item.status === "PARTIALLY_PAID"
                              ? "PARTIALLY PAID"
                              : "PENDING DUE"}
                        </Badge>
                      </td>
                      <td>{formatMoney(item.paidMinor, currency)}</td>
                      <td>
                        <strong style={{ color: item.balanceMinor > 0 ? "#b45309" : "#047857" }}>
                          {formatMoney(item.balanceMinor, currency)}
                        </strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {item.status === "PAID" ? (
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            <span style={{ fontSize: 11, color: "#047857", fontWeight: 750 }}>
                              ✓ Received
                            </span>
                            {item.guardianPhone && (
                              <a
                                href={`https://wa.me/${item.guardianPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                                  `Dear Guardian, fee payment of ${formatMoney(
                                    item.paidMinor,
                                    currency,
                                  )} for ${item.displayName} (${item.cycleMonthLabel}) has been recorded with ${orgName}. Thank you!`,
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-button"
                                style={{ padding: "4px 8px", fontSize: 11 }}
                              >
                                <Icon name="whatsapp" size={13} />
                              </a>
                            )}
                          </div>
                        ) : (
                          <button
                            className="primary-button"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => openCollectFeeModal(item)}
                          >
                            <Icon name="rupee" size={13} />
                            <span>Collect Fee</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: DAILY FAST ATTENDANCE GRID                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "attendance" && (
        <section className="section-card">
          <div className="section-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3>Daily Attendance Fast Grid</h3>
              <p>Single-click attendance marking for tuition, coaching, academies, and batches.</p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--brand)",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              />
              <select
                value={standardFilter}
                onChange={(e) => setStandardFilter(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12 }}
              >
                <option value="ALL">All Standards</option>
                {distinctStandards.map((std) => (
                  <option key={std} value={std}>
                    {std}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-button"
                onClick={handleMarkAllPresent}
                style={{ fontSize: 12, padding: "6px 12px" }}
              >
                ✓ Mark All Present
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSaveAttendance}
                disabled={savingAttendance}
                style={{ fontSize: 12, padding: "6px 14px" }}
              >
                <Icon name="check" size={14} />
                <span>{savingAttendance ? "Saving…" : "Save Attendance"}</span>
              </button>
            </div>
          </div>

          {/* Live Attendance Tally */}
          {attendanceData && (
            <div
              style={{
                display: "flex",
                gap: 16,
                padding: "12px 16px",
                background: "var(--canvas-subtle)",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 12,
                fontWeight: 600,
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--ink)" }}>Total: {attendanceData.totalStudents} Students</span>
              <span style={{ color: "#047857" }}>• Present: {attendanceData.presentCount}</span>
              <span style={{ color: "#b91c1c" }}>• Absent: {attendanceData.absentCount}</span>
              <span style={{ color: "#b45309" }}>• Leave: {attendanceData.leaveCount}</span>
              <span style={{ marginLeft: "auto", fontWeight: 800, color: "var(--brand)" }}>
                Attendance Rate: {attendanceData.attendancePercentage}%
              </span>
            </div>
          )}

          {loadingAttendance ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              Loading attendance sheet…
            </div>
          ) : !attendanceData?.items?.length ? (
            <EmptyState
              title="No active students found"
              description="No active students available for attendance on this date."
            />
          ) : (
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Standard & Batch</th>
                    <th>Primary Phone</th>
                    <th style={{ textAlign: "center" }}>Attendance Toggle</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.items.map((item) => {
                    const currentStatus = attendanceEdits[item.studentProfileId]?.status || "PRESENT";
                    const currentRemarks = attendanceEdits[item.studentProfileId]?.remarks || "";

                    return (
                      <tr key={item.studentProfileId}>
                        <td>
                          <strong>{item.displayName}</strong>
                          {item.rollNumber && <div style={{ fontSize: 11, color: "var(--muted)" }}>#{item.rollNumber}</div>}
                        </td>
                        <td>
                          <div>{item.standard}</div>
                          {item.batch && <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.batch}</div>}
                        </td>
                        <td>{item.primaryPhone || "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              borderRadius: 8,
                              border: "1px solid var(--line)",
                              overflow: "hidden",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(item.studentProfileId, "PRESENT")}
                              style={{
                                padding: "6px 14px",
                                fontSize: 12,
                                fontWeight: currentStatus === "PRESENT" ? 750 : 500,
                                background: currentStatus === "PRESENT" ? "#047857" : "#ffffff",
                                color: currentStatus === "PRESENT" ? "#ffffff" : "var(--ink)",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(item.studentProfileId, "ABSENT")}
                              style={{
                                padding: "6px 14px",
                                fontSize: 12,
                                fontWeight: currentStatus === "ABSENT" ? 750 : 500,
                                background: currentStatus === "ABSENT" ? "#b91c1c" : "#ffffff",
                                color: currentStatus === "ABSENT" ? "#ffffff" : "var(--ink)",
                                borderLeft: "1px solid var(--line)",
                                borderRight: "1px solid var(--line)",
                                borderTop: "none",
                                borderBottom: "none",
                                cursor: "pointer",
                              }}
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(item.studentProfileId, "LEAVE")}
                              style={{
                                padding: "6px 14px",
                                fontSize: 12,
                                fontWeight: currentStatus === "LEAVE" ? 750 : 500,
                                background: currentStatus === "LEAVE" ? "#b45309" : "#ffffff",
                                color: currentStatus === "LEAVE" ? "#ffffff" : "var(--ink)",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              Leave
                            </button>
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="Optional note / reason…"
                            value={currentRemarks}
                            onChange={(e) =>
                              setAttendanceEdits((prev) => ({
                                ...prev,
                                [item.studentProfileId]: {
                                  ...prev[item.studentProfileId],
                                  status: currentStatus,
                                  remarks: e.target.value,
                                },
                              }))
                            }
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "1px solid var(--line)",
                              fontSize: 12,
                              width: "100%",
                              maxWidth: 240,
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: MONTHLY ATTENDANCE SUMMARY REPORT                       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "summary" && (
        <section className="section-card">
          <div className="section-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3>Monthly Attendance & Working Days Report</h3>
              <p>Total working days, present counts, and percentage per student.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--brand)",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          {loadingSummary ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              Loading monthly summary…
            </div>
          ) : !attendanceSummary?.students?.length ? (
            <EmptyState
              title="No attendance records"
              description="No attendance logged for this selected month."
            />
          ) : (
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Name & Roll</th>
                    <th>Standard & Batch</th>
                    <th>Total Working Days</th>
                    <th>Present Days</th>
                    <th>Absent Days</th>
                    <th>Leave Days</th>
                    <th>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceSummary.students.map((st) => (
                    <tr key={st.studentProfileId}>
                      <td>
                        <strong>{st.displayName}</strong>
                        {st.rollNumber && <div style={{ fontSize: 11, color: "var(--muted)" }}>#{st.rollNumber}</div>}
                      </td>
                      <td>
                        <div>{st.standard}</div>
                        {st.batch && <div style={{ fontSize: 11, color: "var(--muted)" }}>{st.batch}</div>}
                      </td>
                      <td>{st.totalWorkingDays}</td>
                      <td style={{ color: "#047857", fontWeight: 700 }}>{st.presentDays}</td>
                      <td style={{ color: "#b91c1c" }}>{st.absentDays}</td>
                      <td style={{ color: "#b45309" }}>{st.leaveDays}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 80,
                              height: 6,
                              borderRadius: 4,
                              background: "#e2e8f0",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, st.percentage)}%`,
                                height: "100%",
                                background: st.percentage >= 75 ? "#047857" : st.percentage >= 50 ? "#b45309" : "#b91c1c",
                              }}
                            />
                          </div>
                          <strong style={{ fontSize: 12 }}>{st.percentage}%</strong>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ONE-TIME NEW STUDENT ADMISSION                          */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={admissionModalOpen}
        onClose={() => setAdmissionModalOpen(false)}
        title="🎓 New Student Admission & Enrollment"
      >
        <form onSubmit={handleSaveAdmission}>
          {admissionError && (
            <div
              style={{
                padding: "10px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#991b1b",
                fontSize: 12,
                marginBottom: 16,
                fontWeight: 600,
              }}
            >
              {admissionError}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Student Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Aryan Sharma"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Student Mobile Number</label>
              <input
                type="tel"
                placeholder="e.g. +91 9876543210"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Student ID / Roll Number</label>
              <input
                type="text"
                placeholder="e.g. STD-101 (leave empty for auto)"
                value={formRollNumber}
                onChange={(e) => setFormRollNumber(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Email ID (Optional)</label>
              <input
                type="email"
                placeholder="student@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Academic & Batch Section */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--canvas-subtle)",
              borderRadius: 8,
              marginBottom: 14,
            }}
          >
            <strong style={{ fontSize: 12, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              Academic & Batch Allocation
            </strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Class / Course / Standard *</label>
                <input
                  type="text"
                  placeholder="e.g. 10th Standard, Dance Batch A, Martial Arts"
                  value={formStandard}
                  onChange={(e) => setFormStandard(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Batch Timing / Shift</label>
                <input
                  type="text"
                  placeholder="e.g. Morning 8:00 AM, Evening Shift"
                  value={formBatch}
                  onChange={(e) => setFormBatch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Guardian Contact Section (For WhatsApp & PDF Receipts) */}
          <div
            style={{
              padding: "12px 14px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              marginBottom: 14,
            }}
          >
            <strong style={{ fontSize: 12, color: "#166534", display: "block", marginBottom: 8 }}>
              Guardian Contact (For Automated WhatsApp & PDF Receipts)
            </strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: "#166534" }}>Guardian Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Sharma"
                  value={formGuardianName}
                  onChange={(e) => setFormGuardianName(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: "#166534" }}>Guardian Mobile *</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={formGuardianPhone}
                  onChange={(e) => setFormGuardianPhone(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: "#166534" }}>Relation</label>
                <select
                  value={formGuardianRelation}
                  onChange={(e) => setFormGuardianRelation(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)" }}
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Self">Self</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recurring Fee Plan Section */}
          <div
            style={{
              padding: "12px 14px",
              background: "#fefce8",
              border: "1px solid #fef08a",
              borderRadius: 8,
              marginBottom: 14,
            }}
          >
            <strong style={{ fontSize: 12, color: "#854d0e", display: "block", marginBottom: 8 }}>
              Recurring Fee Plan (Auto-rolls Every Month)
            </strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: "#854d0e" }}>Billing Frequency</label>
                <select
                  value={formFeeFrequency}
                  onChange={(e) => setFormFeeFrequency(e.target.value as any)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)" }}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: "#854d0e" }}>Fee Amount (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={formFeeAmount}
                  onChange={(e) => setFormFeeAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: "#854d0e" }}>Admission / Start Date</label>
                <input
                  type="date"
                  value={formAdmissionDate}
                  onChange={(e) => setFormAdmissionDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Address & Notes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Street Address</label>
              <input
                type="text"
                placeholder="e.g. 42 MG Road"
                value={formStreet}
                onChange={(e) => setFormStreet(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>City</label>
              <input
                type="text"
                placeholder="e.g. Mumbai"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>State</label>
              <input
                type="text"
                placeholder="e.g. Maharashtra"
                value={formState}
                onChange={(e) => setFormState(e.target.value)}
              />
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAdmissionModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={admissionBusy}
            >
              {admissionBusy ? "Admitting Student…" : "Save Admission & Permanent Profile"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: 1-CLICK COLLECT FEE                                     */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={collectFeeModalOpen}
        onClose={() => setCollectFeeModalOpen(false)}
        title="💳 1-Click Student Fee Collection"
      >
        {receiptSuccessData ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                background: "#dcfce7",
                color: "#166534",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px auto",
              }}
            >
              <Icon name="checkCircle" size={28} />
            </div>
            <h3 style={{ margin: 0, fontSize: 17, color: "var(--ink)" }}>Fee Payment Recorded!</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              Official receipt <strong>{receiptSuccessData.receiptNumber}</strong> generated for {receiptSuccessData.monthLabel}.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
              {receiptSuccessData.whatsappUrl && (
                <a
                  href={receiptSuccessData.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="primary-button"
                  style={{
                    justifyContent: "center",
                    background: "#25D366",
                    borderColor: "#25D366",
                    padding: "10px 16px",
                  }}
                >
                  <Icon name="whatsapp" size={17} />
                  <span>Send Fee Receipt on WhatsApp</span>
                </a>
              )}
              <button
                type="button"
                className="secondary-button"
                style={{ justifyContent: "center", padding: "10px 16px" }}
                onClick={() => setCollectFeeModalOpen(false)}
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          collectFeeStudent && (
            <form onSubmit={handleSaveCollectFee}>
              <div
                style={{
                  padding: "12px 14px",
                  background: "var(--canvas-subtle)",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{collectFeeStudent.displayName}</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {collectFeeStudent.standard} {collectFeeStudent.batch ? `· ${collectFeeStudent.batch}` : ""}
                    </div>
                  </div>
                  <Badge tone="amber">{collectFeeStudent.cycleMonthLabel}</Badge>
                </div>
              </div>

              <div className="form-group">
                <label>Amount to Collect (₹) *</label>
                <input
                  type="number"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Payment Mode</label>
                  <select
                    value={collectMethod}
                    onChange={(e) => setCollectMethod(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)" }}
                  >
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Ref / Transaction ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref 389240"
                    value={collectReference}
                    onChange={(e) => setCollectReference(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Paid in full for the month"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                />
              </div>

              <div className="form-actions" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setCollectFeeModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={collectingFee}
                >
                  {collectingFee ? "Recording Payment…" : `Mark as Paid (${formatMoney(Number(collectAmount) * 100 || 0, currency)})`}
                </button>
              </div>
            </form>
          )
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* DRAWER: STUDENT DETAIL & PROFILE LEDGER                         */}
      {/* ------------------------------------------------------------- */}
      <Drawer
        isOpen={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        title={selectedStudent ? selectedStudent.person.displayName : "Student Profile"}
      >
        {selectedStudent && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Header info card */}
            <div
              style={{
                padding: "16px",
                background: "var(--canvas-subtle)",
                borderRadius: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{selectedStudent.person.displayName}</h3>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {selectedStudent.rollNumber ? `Roll #${selectedStudent.rollNumber} · ` : ""}
                  {selectedStudent.standard} {selectedStudent.batch ? `(${selectedStudent.batch})` : ""}
                </div>
              </div>
              <Badge tone={selectedStudent.status === "ACTIVE" ? "green" : "neutral"}>
                {selectedStudent.status}
              </Badge>
            </div>

            {/* Guardian and Contact */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
              <strong style={{ fontSize: 12, textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 8 }}>
                Contact & Guardian
              </strong>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                <div>📱 <strong>Student Phone:</strong> {selectedStudent.person.primaryPhone || "—"}</div>
                <div>👤 <strong>Guardian Name:</strong> {selectedStudent.guardianName || "—"} ({selectedStudent.guardianRelation || "Guardian"})</div>
                <div>📞 <strong>Guardian Mobile:</strong> {selectedStudent.guardianPhone || "—"}</div>
                <div>✉️ <strong>Email:</strong> {selectedStudent.person.email || "—"}</div>
              </div>
            </div>

            {/* Fee Plan Info */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
              <strong style={{ fontSize: 12, textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 8 }}>
                Fee Plan Configuration
              </strong>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                <div>💰 <strong>Fee Rate:</strong> {formatMoney(selectedStudent.feeAmountMinor, currency)} / {selectedStudent.feeFrequency.toLowerCase()}</div>
                <div>📅 <strong>Enrolled On:</strong> {new Date(selectedStudent.admissionDate).toLocaleDateString("en-IN")}</div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="secondary-button"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  color: selectedStudent.status === "ACTIVE" ? "#b91c1c" : "#047857",
                }}
                onClick={() => handleToggleStatus(selectedStudent.id, selectedStudent.status)}
              >
                {selectedStudent.status === "ACTIVE" ? "Deactivate Student" : "Reactivate Student"}
              </button>
            </div>

            {/* Invoice & Payment History */}
            {studentDetailFull?.person?.invoices && (
              <div>
                <strong style={{ fontSize: 12, textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 8 }}>
                  Recent Invoices & Fee Receipts ({studentDetailFull.person.invoices.length})
                </strong>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {studentDetailFull.person.invoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      style={{
                        padding: "10px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <strong>{inv.invoiceNumber}</strong>
                        <div style={{ color: "var(--muted)", fontSize: 11 }}>
                          {new Date(inv.issueDate).toLocaleDateString("en-IN")} · {inv.notes || "Fee bill"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong>{formatMoney(inv.grandTotalMinor, currency)}</strong>
                        <div>
                          <Badge tone={inv.status === "PAID" ? "green" : "amber"}>
                            {inv.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </AppShell>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading Students Hub…</div>}>
      <StudentsContent />
    </Suspense>
  );
}
