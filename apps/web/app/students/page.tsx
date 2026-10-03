"use client";

import {
  AppShell,
  Badge,
  Drawer,
  Icon,
  Modal,
  StatCard,
  type IconName,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import {
  useWorkspace,
} from "@/lib/nav";

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
    notes?: string | null;
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
  lastPaymentDate?: string | null;
  whatsappUrl?: string | null;
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

function formatMonthLabel(targetMonth: string) {
  try {
    const [y, m] = targetMonth.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("en-US", { month: "long", year: "numeric" });
  } catch {
    return targetMonth;
  }
}

function StudentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = getApiUrl();

  // Active Tab: "directory" | "recurring-fees" | "attendance" | "summary"
  const [activeTab, setActiveTab] = useState<string>("directory");

  const { orgName, userName, userRole, currency, businessType, organisations, navItems, updateWorkspace } = useWorkspace();

  const isGym = (() => {
    const bt = (businessType || "").toLowerCase();
    const on = (orgName || "").toLowerCase();
    return (
      bt.includes("gym") ||
      bt.includes("fitness") ||
      bt.includes("sports") ||
      bt.includes("dance") ||
      bt.includes("yoga") ||
      bt.includes("club") ||
      bt.includes("studio") ||
      bt.includes("crossfit") ||
      bt.includes("martial") ||
      bt.includes("boxing") ||
      on.includes("gym") ||
      on.includes("fitness") ||
      on.includes("crossfit") ||
      on.includes("sports") ||
      on.includes("dance") ||
      on.includes("yoga") ||
      on.includes("studio")
    );
  })();

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
  const [feeStatusFilter, setFeeStatusFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");
  const [feeSearchQuery, setFeeSearchQuery] = useState("");
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
  const [attendanceEdits, setAttendanceEdits] = useState<
    Record<string, { status: "PRESENT" | "ABSENT" | "LEAVE"; remarks: string }>
  >({});
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
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [studentDetailFull, setStudentDetailFull] = useState<any>(null);

  // Fee Collection Modal (12-Month Calendar Grid)
  const [collectFeeModalOpen, setCollectFeeModalOpen] = useState(false);
  const [collectFeeStudent, setCollectFeeStudent] = useState<RecurringFeeItem | null>(null);
  const [collectFeeYear, setCollectFeeYear] = useState<number>(new Date().getFullYear());
  const [collectSelectedMonths, setCollectSelectedMonths] = useState<string[]>([]);
  const [collectPlanMonths, setCollectPlanMonths] = useState<number>(1);
  const [collectAmount, setCollectAmount] = useState(""); // 100% manual input!
  const [collectMethod, setCollectMethod] = useState("UPI");
  const [collectReference, setCollectReference] = useState("");
  const [collectNotes, setCollectNotes] = useState("");
  const [collectingFee, setCollectingFee] = useState(false);
  const [receiptSuccessData, setReceiptSuccessData] = useState<{
    receiptNumber: string;
    monthLabel: string;
    whatsappUrl: string | null;
    invoiceId?: string;
    amountPaidMinor?: number;
    balanceDueMinor?: number;
    totalFeeMinor?: number;
    emailSent?: boolean;
    emailTarget?: string | null;
  } | null>(null);

  // Admission & Edit Form State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAltPhone, setFormAltPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formRollNumber, setFormRollNumber] = useState("");
  const [formStandard, setFormStandard] = useState("");
  const [customStandard, setCustomStandard] = useState("");
  const [formBatch, setFormBatch] = useState("");
  const [formGuardianName, setFormGuardianName] = useState("");
  const [formGuardianPhone, setFormGuardianPhone] = useState("");
  const [formGuardianRelation, setFormGuardianRelation] = useState("Self");
  const [formFeeFrequency, setFormFeeFrequency] = useState<"MONTHLY" | "QUARTERLY" | "ANNUAL">("MONTHLY");
  const [formPlanMonths, setFormPlanMonths] = useState<number>(1);
  const [formFeeAmount, setFormFeeAmount] = useState("");
  const [admissionPaymentStatus, setAdmissionPaymentStatus] = useState<"PAID_NOW" | "PENDING">("PAID_NOW");
  const [admissionPaymentMethod, setAdmissionPaymentMethod] = useState<string>("UPI");
  const [admissionAmountPaid, setAdmissionAmountPaid] = useState<string>("");
  const [feePlanType, setFeePlanType] = useState<"MONTHLY" | "TERM_INSTALLMENTS">("MONTHLY");
  const [term1Amount, setTerm1Amount] = useState("15000");
  const [term1DueDate, setTerm1DueDate] = useState("2026-04-15");
  const [term2Amount, setTerm2Amount] = useState("15000");
  const [term2DueDate, setTerm2DueDate] = useState("2026-08-15");
  const [term3Amount, setTerm3Amount] = useState("15000");
  const [term3DueDate, setTerm3DueDate] = useState("2026-12-15");
  const [formAdmissionDate, setFormAdmissionDate] = useState(todayYyyyMmDd);
  const [formNotes, setFormNotes] = useState("");
  const [admissionBusy, setAdmissionBusy] = useState(false);
  const [admissionError, setAdmissionError] = useState("");

  // 12-Month Calendar Grid state for Admission Enrollment
  const [admissionYear, setAdmissionYear] = useState<number>(new Date().getFullYear());
  const [admissionSelectedMonths, setAdmissionSelectedMonths] = useState<string[]>(() => {
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return [cur];
  });

  function toggleAdmissionMonth(yyyyMm: string) {
    setAdmissionSelectedMonths((prev) => {
      const exists = prev.includes(yyyyMm);
      const next = exists ? prev.filter((m) => m !== yyyyMm) : [...prev, yyyyMm].sort();
      const count = Math.max(1, next.length);
      setFormPlanMonths(count);
      if (count === 3) setFormFeeFrequency("QUARTERLY");
      else if (count === 12) setFormFeeFrequency("ANNUAL");
      else setFormFeeFrequency("MONTHLY");
      return next;
    });
    // NOTE: NEVER auto-calculate or change formFeeAmount or admissionAmountPaid! Amount is 100% manual entry.
  }

  function quickSelectAdmissionMonths(count: number) {
    const now = new Date();
    const startM = now.getFullYear() === admissionYear ? now.getMonth() + 1 : 1;
    const months: string[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(admissionYear, (startM - 1) + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(ym);
    }
    const sorted = months.sort();
    setAdmissionSelectedMonths(sorted);
    setFormPlanMonths(count);
    if (count === 3) setFormFeeFrequency("QUARTERLY");
    else if (count === 12) setFormFeeFrequency("ANNUAL");
    else setFormFeeFrequency("MONTHLY");
    // NOTE: NEVER auto-calculate or change formFeeAmount or admissionAmountPaid! Amount is 100% manual entry.
  }

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
          const srvs = activeOrgEntry.activeServices || activeOrgEntry.organisation.activeServices;
          updateWorkspace({
            orgName: activeOrgEntry.organisation.name,
            userRole: activeOrgEntry.role?.name || "Admin",
            currency: activeOrgEntry.organisation.currency || "INR",
            businessType: activeOrgEntry.organisation.businessType || undefined,
            ...(Array.isArray(srvs) && srvs.length > 0 ? { activeServices: srvs } : {}),
          });
        }
      }
    } catch {
      // ignore
    }
  }, [api, router, updateWorkspace]);

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
      resetAdmissionForm();
      setAdmissionModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isGym) {
      setFormStandard((prev) => (!prev || prev === "10th Standard" ? "General Gym (Weights & Cardio)" : prev));
      setFormBatch((prev) => (!prev || prev === "Morning Batch" ? "Full Day Flexible Access" : prev));
      setFormGuardianRelation((prev) => (prev === "Father" ? "Self" : prev));
    }
  }, [isGym]);

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
      setAdmissionError(isGym ? "Please enter member full name." : "Please enter student full name.");
      return;
    }

    let finalStandard = formStandard.trim();
    if (isGym && (finalStandard === "Custom Plan" || !finalStandard || finalStandard === "10th Standard" || finalStandard === "General")) {
      finalStandard = customStandard.trim() || "General Gym (Weights & Cardio)";
    } else if (!finalStandard) {
      finalStandard = isGym ? "General Gym (Weights & Cardio)" : "General";
    }

    let finalBatch = formBatch.trim();
    if (isGym && (!finalBatch || finalBatch === "Morning Batch" || finalBatch === "Regular")) {
      finalBatch = "Full Day Flexible Access";
    }

    setAdmissionBusy(true);
    setAdmissionError("");
    try {
      let finalNotes = formNotes.trim();
      let calculatedFeeAmount = Math.round(Number(formFeeAmount) * 100) || 0;
      let finalFeeFrequency = formFeeFrequency;
      if (formPlanMonths === 3) {
        finalFeeFrequency = "QUARTERLY";
      } else if (formPlanMonths === 12) {
        finalFeeFrequency = "ANNUAL";
      } else if (formPlanMonths === 1) {
        finalFeeFrequency = "MONTHLY";
      }

      if (!isGym && feePlanType === "TERM_INSTALLMENTS") {
        finalFeeFrequency = "QUARTERLY";
        const t1 = Math.round(Number(term1Amount) * 100) || 0;
        calculatedFeeAmount = t1;
        const termMetadata = `[TERM_PLAN:Term 1:₹${term1Amount}:${term1DueDate}|Term 2:₹${term2Amount}:${term2DueDate}|Term 3:₹${term3Amount}:${term3DueDate}]`;
        finalNotes = finalNotes ? `${finalNotes}\n${termMetadata}` : termMetadata;
      }

      const planTag = `[PLAN_VALIDITY:${formPlanMonths || 1}_MONTHS]`;
      if (!finalNotes.includes("[PLAN_VALIDITY:")) {
        finalNotes = finalNotes ? `${finalNotes}\n${planTag}` : planTag;
      }

      const paidNowNum = admissionPaymentStatus === "PAID_NOW" ? Number(admissionAmountPaid || formFeeAmount || 0) : 0;
      const initialPaymentMinor = paidNowNum > 0 ? Math.round(paidNowNum * 100) : undefined;

      const addressPayload: Record<string, any> = {};
      if (formStreet.trim()) addressPayload.street = formStreet.trim();
      if (formCity.trim()) addressPayload.city = formCity.trim();
      if (formState.trim()) addressPayload.state = formState.trim();
      if (formPlanMonths) addressPayload.planValidityMonths = String(formPlanMonths);
      if (admissionSelectedMonths.length > 0) addressPayload.paidMonths = admissionSelectedMonths;
      if (formGuardianName.trim()) addressPayload.guardianName = formGuardianName.trim();
      if (formGuardianPhone.trim()) addressPayload.guardianPhone = formGuardianPhone.trim();
      if (formGuardianRelation.trim()) addressPayload.guardianRelation = formGuardianRelation.trim();
      if (formRollNumber.trim()) addressPayload.admissionNumber = formRollNumber.trim();
      if (formAdmissionDate) addressPayload.admissionDate = formAdmissionDate;
      if (finalStandard) addressPayload.standard = finalStandard;
      if (finalBatch) addressPayload.batch = finalBatch;

      const payload = {
        displayName: formName.trim(),
        primaryPhone: formPhone.trim() || undefined,
        alternatePhone: formAltPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        address: Object.keys(addressPayload).length > 0 ? addressPayload : undefined,
        selectedMonths: admissionSelectedMonths.length > 0 ? admissionSelectedMonths : undefined,
        rollNumber: formRollNumber.trim() || undefined,
        standard: finalStandard,
        batch: finalBatch || undefined,
        guardianName: formGuardianName.trim() || undefined,
        guardianPhone: formGuardianPhone.trim() || undefined,
        guardianRelation: formGuardianRelation.trim() || undefined,
        feeFrequency: finalFeeFrequency,
        feeAmountMinor: calculatedFeeAmount,
        admissionDate: formAdmissionDate,
        billingStartDate: formAdmissionDate,
        notes: finalNotes || undefined,
        initialPaymentAmountMinor: initialPaymentMinor,
        initialPaymentMethod: initialPaymentMinor ? admissionPaymentMethod : undefined,
      };

      const res = await authFetch(`${api}/students`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (isGym ? "Failed to enroll member." : "Failed to create student admission."));
      }

      // Close modal immediately for instant, snappy user experience
      setAdmissionModalOpen(false);
      resetAdmissionForm();
      showToast(
        isGym
          ? `Member ${data.person?.displayName || formName} enrolled successfully${admissionPaymentStatus === "PAID_NOW" ? " & fee recorded as PAID!" : "!"}`
          : `Student ${data.person?.displayName || formName} admitted successfully${admissionPaymentStatus === "PAID_NOW" ? " & fee recorded as PAID!" : "!"}`,
        "success"
      );

      // Refresh data in background without blocking modal close
      loadStudents();
      loadRecurringFees();
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

    // Auto-generate Member ID / Reg No in Gym mode
    if (isGym) {
      const existingGymNums = students
        .map((s) => {
          const m = s.rollNumber?.match(/GYM-(\d+)/i);
          return m && m[1] ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => !isNaN(n) && n > 0);
      const nextGymId = existingGymNums.length > 0 ? Math.max(...existingGymNums) + 1 : 1001 + students.length;
      setFormRollNumber(`GYM-${nextGymId}`);
    } else {
      setFormRollNumber("");
    }

    setFormPlanMonths(1);
    setAdmissionYear(new Date().getFullYear());
    const now = new Date();
    const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setAdmissionSelectedMonths([curYm]);
    setFormStandard(isGym ? "General Gym (Weights & Cardio)" : "10th Standard");
    setCustomStandard("");
    setFormBatch(isGym ? "Full Day Flexible Access" : "Morning Batch");
    setFormGuardianName("");
    setFormGuardianPhone("");
    setFormGuardianRelation(isGym ? "Self" : "Father");
    setFormFeeFrequency("MONTHLY");
    setFormFeeAmount("");
    setAdmissionPaymentStatus("PAID_NOW");
    setAdmissionPaymentMethod("UPI");
    setAdmissionAmountPaid("");
    setFormAdmissionDate(todayYyyyMmDd);
    setFormNotes("");
    setAdmissionError("");
  }

  function handleOpenEdit(std: StudentProfile) {
    setEditingStudent(std);
    setFormName(std.person.displayName || "");
    setFormPhone(std.person.primaryPhone || "");
    setFormAltPhone(std.person.alternatePhone || "");
    setFormEmail(std.person.email || "");
    setFormStreet(std.person.address?.street || "");
    setFormCity(std.person.address?.city || "");
    setFormState(std.person.address?.state || "");
    setFormRollNumber(std.rollNumber || "");
    setFormStandard(std.standard || "10th Standard");
    setFormBatch(std.batch || "");
    setFormGuardianName(std.guardianName || "");
    setFormGuardianPhone(std.guardianPhone || "");
    setFormGuardianRelation(std.guardianRelation || "Father");
    setFormFeeFrequency(std.feeFrequency || "MONTHLY");

    const addrJson = (std.person.address || {}) as any;
    let months = 1;
    if (addrJson?.planValidityMonths) {
      months = parseInt(addrJson.planValidityMonths, 10) || 1;
    } else if (std.feeFrequency === "ANNUAL") {
      months = 12;
    } else if (std.feeFrequency === "QUARTERLY") {
      months = 3;
    }
    setFormPlanMonths(months);

    setFormFeeAmount(((std.feeAmountMinor || 0) / 100).toString());
    setFormNotes(std.person.notes || "");
    setFormStatus(std.status || "ACTIVE");
    setEditError("");
    setEditModalOpen(true);
  }

  async function handleSaveEditStudent(e: FormEvent) {
    e.preventDefault();
    if (!editingStudent) return;
    if (!formName.trim()) {
      setEditError("Student full name is required.");
      return;
    }
    if (!formStandard.trim()) {
      setEditError("Standard / Class is required.");
      return;
    }

    setEditBusy(true);
    setEditError("");

    try {
      const addressPayload: Record<string, string> = {};
      if (formStreet.trim()) addressPayload.street = formStreet.trim();
      if (formCity.trim()) addressPayload.city = formCity.trim();
      if (formState.trim()) addressPayload.state = formState.trim();
      if (formPlanMonths) addressPayload.planValidityMonths = String(formPlanMonths);
      if (formGuardianName.trim()) addressPayload.guardianName = formGuardianName.trim();
      if (formGuardianPhone.trim()) addressPayload.guardianPhone = formGuardianPhone.trim();
      if (formGuardianRelation.trim()) addressPayload.guardianRelation = formGuardianRelation.trim();
      if (formRollNumber.trim()) addressPayload.admissionNumber = formRollNumber.trim();

      let editFeeFreq = formFeeFrequency;
      if (formPlanMonths === 3) editFeeFreq = "QUARTERLY";
      else if (formPlanMonths === 12) editFeeFreq = "ANNUAL";
      else if (formPlanMonths === 1) editFeeFreq = "MONTHLY";

      const payload = {
        displayName: formName.trim(),
        primaryPhone: formPhone.trim() || null,
        alternatePhone: formAltPhone.trim() || null,
        email: formEmail.trim() || null,
        address: Object.keys(addressPayload).length > 0 ? addressPayload : undefined,
        rollNumber: formRollNumber.trim() || null,
        standard: formStandard.trim(),
        batch: formBatch.trim() || null,
        guardianName: formGuardianName.trim() || null,
        guardianPhone: formGuardianPhone.trim() || null,
        guardianRelation: formGuardianRelation.trim() || null,
        feeFrequency: editFeeFreq,
        feeAmountMinor: Math.max(0, Math.round(Number(formFeeAmount || 0) * 100)),
        status: formStatus,
        notes: formNotes.trim() || null,
      };

      const res = await authFetch(`${api}/students/${editingStudent.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update student profile.");
      }

      showToast(`Student ${payload.displayName} updated successfully!`, "success");
      setEditModalOpen(false);
      loadStudents();
      loadRecurringFees();

      if (selectedStudent?.id === editingStudent.id) {
        setSelectedStudent((prev) =>
          prev
            ? {
                ...prev,
                rollNumber: payload.rollNumber,
                standard: payload.standard,
                batch: payload.batch,
                guardianName: payload.guardianName,
                guardianPhone: payload.guardianPhone,
                guardianRelation: payload.guardianRelation,
                feeFrequency: payload.feeFrequency,
                feeAmountMinor: payload.feeAmountMinor,
                status: payload.status,
                person: {
                  ...prev.person,
                  displayName: payload.displayName,
                  primaryPhone: payload.primaryPhone,
                  alternatePhone: payload.alternatePhone,
                  email: payload.email,
                  notes: payload.notes,
                },
              }
            : null,
        );
      }
    } catch (err: any) {
      setEditError(err.message || "Error updating student details.");
    } finally {
      setEditBusy(false);
    }
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

  function getStudentPaidMonths(studentProfileId: string, year?: number): Set<string> {
    const paidSet = new Set<string>();
    const std = students.find((s) => s.id === studentProfileId);
    const addr = (std?.person?.address && typeof std.person.address === "object" ? std.person.address : {}) as Record<string, any>;
    if (Array.isArray(addr.paidMonths)) {
      addr.paidMonths.forEach((m: string) => {
        if (typeof m === "string" && /^\d{4}-\d{2}$/.test(m)) paidSet.add(m);
      });
    }



    const items = recurringFeesData?.items || [];
    items.forEach((f) => {
      if (f.studentProfileId === studentProfileId && f.status === "PAID") {
        paidSet.add(f.cycleMonth);
      }
    });

    return paidSet;
  }

  // 1-Click Fee Collection Modal Open (12-Month Calendar Grid)
  function openCollectFeeModal(item: RecurringFeeItem) {
    setCollectFeeStudent(item);
    const currentYear = new Date().getFullYear();
    setCollectFeeYear(currentYear);
    setCollectSelectedMonths(item.status !== "PAID" ? [item.cycleMonth] : []);
    setCollectAmount(""); // 100% manual input! Never auto-calculated!
    setCollectMethod("UPI");
    setCollectReference("");
    setCollectNotes("");
    setReceiptSuccessData(null);
    setCollectFeeModalOpen(true);
  }

  function toggleCollectMonth(yyyyMm: string, isPaid: boolean) {
    if (isPaid) return;
    setCollectSelectedMonths((prev) => {
      if (prev.includes(yyyyMm)) {
        return prev.filter((m) => m !== yyyyMm);
      } else {
        return [...prev, yyyyMm].sort();
      }
    });
    // NOTE: NEVER auto-calculate or change collectAmount! 100% manual input!
  }

  function quickSelectCollectMonths(count: number) {
    if (!collectFeeStudent) return;
    const paidSet = getStudentPaidMonths(collectFeeStudent.studentProfileId, collectFeeYear);
    const months: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const yyyyMm = `${collectFeeYear}-${String(m).padStart(2, "0")}`;
      if (!paidSet.has(yyyyMm)) {
        months.push(yyyyMm);
        if (months.length === count) break;
      }
    }
    setCollectSelectedMonths(months.sort());
    // NOTE: NEVER auto-calculate or change collectAmount! 100% manual input!
  }

  // Handle Fee Collection Submit
  async function handleSaveCollectFee(e: FormEvent) {
    e.preventDefault();
    if (!collectFeeStudent) return;
    if (collectSelectedMonths.length === 0) {
      alert("Please select at least one month on the calendar grid to mark as paid.");
      return;
    }
    const amountNum = Number(collectAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid fee amount manually.");
      return;
    }
    setCollectingFee(true);
    try {
      const payload = {
        studentProfileId: collectFeeStudent.studentProfileId,
        month: collectSelectedMonths[0] || collectFeeStudent.cycleMonth,
        selectedMonths: collectSelectedMonths,
        amountMinor: Math.round(amountNum * 100),
        planMonths: Math.max(1, collectSelectedMonths.length),
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
        amountPaidMinor: data.amountPaidMinor,
        balanceDueMinor: data.balanceDueMinor,
        totalFeeMinor: data.totalFeeMinor,
        emailSent: data.emailSent,
        emailTarget: data.emailTarget,
      });

      loadRecurringFees();
      showToast(`Fee of ₹${amountNum.toLocaleString("en-IN")} collected for ${collectSelectedMonths.length} month(s)!`, "success");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCollectingFee(false);
    }
  }

  // Attendance fast toggles with 1-click Auto-Save
  async function handleToggleAttendance(
    studentId: string,
    status: "PRESENT" | "ABSENT" | "LEAVE",
    studentName?: string,
  ) {
    // 1. Optimistically update edits
    setAttendanceEdits((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        remarks: prev[studentId]?.remarks || "",
      },
    }));

    // 2. Optimistically update attendanceData live summary metrics
    setAttendanceData((prev) => {
      if (!prev) return prev;
      const updatedItems = prev.items.map((it) =>
        it.studentProfileId === studentId ? { ...it, status } : it,
      );
      let pCount = 0;
      let aCount = 0;
      let lCount = 0;
      for (const it of updatedItems) {
        if (it.status === "PRESENT") pCount++;
        else if (it.status === "ABSENT") aCount++;
        else if (it.status === "LEAVE") lCount++;
      }
      const total = updatedItems.length;
      const pct = total > 0 ? Math.round((pCount / total) * 100) : 0;
      return {
        ...prev,
        presentCount: pCount,
        absentCount: aCount,
        leaveCount: lCount,
        attendancePercentage: pct,
        items: updatedItems,
      };
    });

    // 3. Immediately persist to API
    try {
      const res = await authFetch(`${api}/students/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          records: [
            {
              studentProfileId: studentId,
              status,
              remarks: attendanceEdits[studentId]?.remarks?.trim() || undefined,
            },
          ],
        }),
      });

      if (res.ok) {
        showToast(
          studentName
            ? `Marked ${studentName} as ${status}!`
            : `Attendance updated to ${status}!`,
          "success",
        );
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || "Failed to save attendance.", "error");
        loadAttendance();
      }
    } catch {
      showToast("Error saving attendance.", "error");
      loadAttendance();
    }
  }

  async function handleMarkAllPresent() {
    if (!attendanceData?.items?.length) return;
    const edits: Record<string, { status: "PRESENT" | "ABSENT" | "LEAVE"; remarks: string }> = {};
    const records = attendanceData.items.map((it) => {
      edits[it.studentProfileId] = {
        status: "PRESENT",
        remarks: attendanceEdits[it.studentProfileId]?.remarks || "",
      };
      return {
        studentProfileId: it.studentProfileId,
        status: "PRESENT" as const,
        remarks: attendanceEdits[it.studentProfileId]?.remarks?.trim() || undefined,
      };
    });
    setAttendanceEdits(edits);

    setAttendanceData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        presentCount: prev.totalStudents,
        absentCount: 0,
        leaveCount: 0,
        attendancePercentage: 100,
        items: prev.items.map((it) => ({ ...it, status: "PRESENT" })),
      };
    });

    try {
      const res = await authFetch(`${api}/students/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          records,
        }),
      });
      if (res.ok) {
        showToast(`All ${records.length} students marked Present & saved!`, "success");
      } else {
        showToast("Failed to save batch attendance.", "error");
        loadAttendance();
      }
    } catch {
      showToast("Error saving batch attendance.", "error");
      loadAttendance();
    }
  }

  async function handleMarkAllAbsent() {
    if (!attendanceData?.items?.length) return;
    const edits: Record<string, { status: "PRESENT" | "ABSENT" | "LEAVE"; remarks: string }> = {};
    const records = attendanceData.items.map((it) => {
      edits[it.studentProfileId] = {
        status: "ABSENT",
        remarks: attendanceEdits[it.studentProfileId]?.remarks || "",
      };
      return {
        studentProfileId: it.studentProfileId,
        status: "ABSENT" as const,
        remarks: attendanceEdits[it.studentProfileId]?.remarks?.trim() || undefined,
      };
    });
    setAttendanceEdits(edits);

    setAttendanceData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        presentCount: 0,
        absentCount: prev.totalStudents,
        leaveCount: 0,
        attendancePercentage: 0,
        items: prev.items.map((it) => ({ ...it, status: "ABSENT" })),
      };
    });

    try {
      const res = await authFetch(`${api}/students/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          records,
        }),
      });
      if (res.ok) {
        showToast(`All ${records.length} students marked Absent & saved!`, "success");
      } else {
        showToast("Failed to save batch attendance.", "error");
        loadAttendance();
      }
    } catch {
      showToast("Error saving batch attendance.", "error");
      loadAttendance();
    }
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
  const distinctBatches = Array.from(
    new Set(students.map((s) => s.batch).filter((b): b is string => Boolean(b))),
  );

  const tabItems = [
    {
      id: "directory",
      label: isGym ? "Members Directory" : "Student Directory",
      icon: (isGym ? "people" : "student") as IconName,
      count: students.length,
    },
    {
      id: "recurring-fees",
      label: isGym ? "Upcoming Fees & Dues" : "Recurring Fees Cycle",
      icon: "finance" as const,
      count: recurringFeesData?.pendingCount ?? 0,
      highlight: (recurringFeesData?.pendingCount ?? 0) > 0,
    },
    {
      id: "attendance",
      label: isGym ? "Daily Check-in & Attendance" : "Daily Attendance Grid",
      icon: "calendar" as const,
    },
    {
      id: "summary",
      label: isGym ? "Monthly Revenue Report" : "Monthly Summary Report",
      icon: "reports" as const,
    },
  ];

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/students"
      nav={navItems}
      userName={userName}
      userRole={userRole}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
      onPrefetch={(href) => router.prefetch(href)}
    >
      {/* Toast Feedback */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: "14px 22px",
            borderRadius: 12,
            background: toast.type === "success" ? "#064e3b" : "#7f1d1d",
            color: "#ffffff",
            boxShadow: "0 20px 30px -10px rgba(0, 0, 0, 0.35)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 13.5,
            fontWeight: 650,
            animation: "slideUp 0.2s ease-out",
          }}
        >
          <Icon name={toast.type === "success" ? "checkCircle" : "alertCircle"} size={20} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Heading */}
      <div
        className="page-heading"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              fontWeight: 750,
              color: "var(--brand)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            <Icon name={isGym ? "activity" : "student"} size={15} />{" "}
            {isGym ? "Member Lifecycle & Fitness Portal" : "Student Lifecycle & Academy Portal"}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", margin: 0, letterSpacing: "-0.02em" }}>
            {isGym ? "Memberships & Gym Management" : "Students & Academy Management"}
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "4px 0 0", maxWidth: 650 }}>
            {isGym
              ? "Track member enrollments, recurring membership fees rolling ledger, and 1-click check-ins."
              : "Track one-time student admissions, automated recurring monthly fees rolling ledger, and 1-click attendance."}
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            resetAdmissionForm();
            setAdmissionModalOpen(true);
          }}
          style={{
            padding: "10px 18px",
            fontSize: 13.5,
            fontWeight: 700,
            borderRadius: 10,
            boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <Icon name="plus" size={16} />
          <span>{isGym ? "New Member Admission" : "New Student Admission"}</span>
        </button>
      </div>

      {/* Quick Summary Metric Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label={isGym ? "Active Members" : "Active Students"}
          value={students.filter((s) => s.status === "ACTIVE").length.toString()}
          change={isGym ? `${distinctStandards.length} Plans · ${distinctBatches.length} Slots` : `${distinctStandards.length} Standards · ${distinctBatches.length} Batches`}
          icon={isGym ? "people" : "student"}
          tone="teal"
        />
        <StatCard
          label={`${recurringFeesData?.cycleMonthLabel || "This Month"} Fees Collected`}
          value={formatMoney(recurringFeesData?.totalCollectedMinor || 0, currency)}
          change={`${recurringFeesData?.paidCount || 0} ${isGym ? "members" : "students"} cleared`}
          icon="finance"
          tone="blue"
        />
        <StatCard
          label="Pending Fee Dues"
          value={formatMoney(recurringFeesData?.totalPendingMinor || 0, currency)}
          change={`${recurringFeesData?.pendingCount || 0} ${isGym ? "members" : "students"} due`}
          icon="rupee"
          tone="amber"
        />
        <StatCard
          label={isGym ? "Today's Check-ins" : "Today's Attendance"}
          value={`${attendanceData?.attendancePercentage ?? 0}%`}
          change={`${attendanceData?.presentCount ?? 0} Checked in / ${attendanceData?.totalStudents ?? 0} Total`}
          icon="calendar"
          tone="rose"
        />
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div style={{ marginBottom: 20, width: "100%", overflowX: "auto" }}>
        <div
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            padding: "4px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            gap: "4px",
            maxWidth: "100%",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            whiteSpace: "nowrap",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: 13,
                  fontWeight: isActive ? 750 : 550,
                  border: isActive ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent",
                  background: isActive ? "#ffffff" : "transparent",
                  color: isActive ? "var(--ink)" : "#64748b",
                  boxShadow: isActive ? "0 2px 5px rgba(0,0,0,0.06)" : "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <Icon name={tab.icon} size={15} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 7px",
                      borderRadius: 10,
                      background: isActive ? (tab.highlight ? "#fef3c7" : "#f1f5f9") : "#e2e8f0",
                      color: isActive ? (tab.highlight ? "#92400e" : "#0f172a") : "#64748b",
                      fontWeight: 750,
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
        <section className="section-card" style={{ padding: "22px 26px" }}>
          <div
            className="section-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
              paddingBottom: 16,
              borderBottom: "1px solid #f1f5f9",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 750, margin: 0 }}>Student Directory</h3>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 0" }}>
                Enrolled students, class batches, parent/guardian phone, and active status.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search name, roll, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: "8px 14px 8px 34px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    width: 230,
                    background: "#ffffff",
                    outline: "none",
                  }}
                />
                <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>
                  <Icon name="search" size={14} />
                </div>
              </div>
              <select
                value={standardFilter}
                onChange={(e) => setStandardFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 12.5,
                  background: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
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
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 12.5,
                  background: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <option value="ACTIVE">Active Students</option>
                <option value="INACTIVE">Inactive / Alumni</option>
                <option value="ALL">All Status</option>
              </select>
            </div>
          </div>

          {loadingStudents ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Loading student directory…
            </div>
          ) : students.length === 0 ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                background: "#fafbfd",
                borderRadius: 14,
                border: "1px dashed #cbd5e1",
                margin: "10px 0",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  color: "var(--brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <Icon name="student" size={28} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 750, margin: "0 0 6px", color: "var(--ink)" }}>
                No {isGym ? "members" : "students"} enrolled yet
              </h3>
              <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 440, margin: "0 auto 20px" }}>
                {isGym
                  ? "Enroll members with workout package/slot, emergency contact, and membership fee plan."
                  : "Admit students with class/batch, guardian phone for WhatsApp receipts, and recurring fee plan."}
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  resetAdmissionForm();
                  setAdmissionModalOpen(true);
                }}
                style={{
                  padding: "9px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon name="plus" size={15} />
                <span>{isGym ? "Enroll First Member" : "Admit First Student"}</span>
              </button>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{isGym ? "Member Details" : "Student Details"}</th>
                    <th>{isGym ? "Plan & Slot" : "Standard & Batch"}</th>
                    <th>{isGym ? "Emergency / Contact" : "Guardian / Parent"}</th>
                    <th>{isGym ? "Membership Fee" : "Fee Plan"}</th>
                    <th>Enrolled On</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((std) => (
                    <tr
                      key={std.id}
                      style={{ cursor: "pointer", opacity: std.status === "INACTIVE" ? 0.6 : 1 }}
                      onClick={() => handleOpenDetail(std)}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: std.status === "ACTIVE" ? "#0f766e" : "#64748b",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 750,
                              fontSize: 13.5,
                              flexShrink: 0,
                            }}
                          >
                            {std.person.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ fontSize: 13.5, color: "var(--ink)" }}>{std.person.displayName}</strong>
                            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>
                              {std.rollNumber ? `ID #${std.rollNumber}` : "No Roll"} · {std.person.primaryPhone || "No Phone"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 650, fontSize: 13 }}>{std.standard}</div>
                        {std.batch && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{std.batch}</div>}
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {std.guardianName || (isGym ? std.person.displayName : "—")}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                          {std.guardianRelation ? `(${std.guardianRelation}) ` : ""}
                          {std.guardianPhone || (isGym ? std.person.primaryPhone : "—")}
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: "var(--ink)", fontSize: 13 }}>
                          {formatMoney(std.feeAmountMinor, currency)}
                        </strong>
                        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "lowercase" }}>
                          /{(() => {
                            const valMonths = (std.person.address as any)?.planValidityMonths;
                            if (valMonths) return valMonths === "1" ? "1 month" : `${valMonths} months`;
                            return std.feeFrequency.toLowerCase();
                          })()}
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
                            style={{
                              padding: "5px 10px",
                              fontSize: 11.5,
                              borderRadius: 6,
                              fontWeight: 700,
                              color: "var(--brand)",
                              background: "rgba(37, 99, 235, 0.06)",
                              borderColor: "rgba(37, 99, 235, 0.2)",
                            }}
                            onClick={() => handleOpenEdit(std)}
                            title="Edit student details & fee plan"
                          >
                            Edit
                          </button>
                          <button
                            className="secondary-button"
                            style={{
                              padding: "5px 10px",
                              fontSize: 11.5,
                              borderRadius: 6,
                              fontWeight: 650,
                            }}
                            onClick={() => handleOpenDetail(std)}
                          >
                            View
                          </button>
                          <button
                            className="secondary-button"
                            style={{
                              padding: "5px 10px",
                              fontSize: 11.5,
                              borderRadius: 6,
                              fontWeight: 650,
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
        <section className="section-card" style={{ padding: "22px 26px" }}>
          <div
            className="section-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
              paddingBottom: 16,
              borderBottom: "1px solid #f1f5f9",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 750, margin: 0 }}>
                Automated Monthly Fee Cycle & Rolling Ledger
              </h3>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 0" }}>
                Auto-rolls monthly fee dues. 1-Click Collect creates official receipt and sends instant WhatsApp link!
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>Billing Cycle:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--brand)",
                  fontWeight: 700,
                  fontSize: 13,
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              />
            </div>
          </div>

          {/* Rolling Fee Progress Ribbon */}
          {recurringFeesData && (
            <div
              style={{
                padding: "18px 22px",
                background: "#f8fafc",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                marginBottom: 20,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 18,
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 750, letterSpacing: "0.04em" }}>
                  Expected Fee ({recurringFeesData.cycleMonthLabel})
                </span>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginTop: 2 }}>
                  {formatMoney(recurringFeesData.totalExpectedMinor, currency)}
                </div>
                <small style={{ color: "var(--muted)", fontSize: 11.5 }}>
                  {recurringFeesData.studentsCount} Active {isGym ? "members" : "students"} enrolled
                </small>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "#047857", textTransform: "uppercase", fontWeight: 750, letterSpacing: "0.04em" }}>
                  Collected Revenue
                </span>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#047857", marginTop: 2 }}>
                  {formatMoney(recurringFeesData.totalCollectedMinor, currency)}
                </div>
                <small style={{ color: "#047857", fontSize: 11.5 }}>
                  {recurringFeesData.paidCount} {isGym ? "members" : "students"} cleared
                </small>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "#b45309", textTransform: "uppercase", fontWeight: 750, letterSpacing: "0.04em" }}>
                  Pending Dues
                </span>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#b45309", marginTop: 2 }}>
                  {formatMoney(recurringFeesData.totalPendingMinor, currency)}
                </div>
                <small style={{ color: "#b45309", fontSize: 11.5 }}>
                  {recurringFeesData.pendingCount} {isGym ? "members" : "students"} pending
                </small>
              </div>
            </div>
          )}

          {/* Status Filter & Search Controls */}
          {recurringFeesData && recurringFeesData.items?.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 16,
              }}
            >
              {/* Status Filter Pills */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setFeeStatusFilter("ALL")}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12.5,
                    borderRadius: 20,
                    cursor: "pointer",
                    fontWeight: 700,
                    border: feeStatusFilter === "ALL" ? "1px solid var(--brand)" : "1px solid #cbd5e1",
                    background: feeStatusFilter === "ALL" ? "var(--brand)" : "#ffffff",
                    color: feeStatusFilter === "ALL" ? "#ffffff" : "var(--ink)",
                    transition: "all 0.15s ease",
                  }}
                >
                  All ({recurringFeesData.items?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFeeStatusFilter("PENDING")}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12.5,
                    borderRadius: 20,
                    cursor: "pointer",
                    fontWeight: 700,
                    border: feeStatusFilter === "PENDING" ? "1px solid #b45309" : "1px solid #fed7aa",
                    background: feeStatusFilter === "PENDING" ? "#b45309" : "#fffbeb",
                    color: feeStatusFilter === "PENDING" ? "#ffffff" : "#b45309",
                    transition: "all 0.15s ease",
                  }}
                >
                  Pending Dues ({recurringFeesData.pendingCount || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFeeStatusFilter("PAID")}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12.5,
                    borderRadius: 20,
                    cursor: "pointer",
                    fontWeight: 700,
                    border: feeStatusFilter === "PAID" ? "1px solid #047857" : "1px solid #a7f3d0",
                    background: feeStatusFilter === "PAID" ? "#047857" : "#ecfdf5",
                    color: feeStatusFilter === "PAID" ? "#ffffff" : "#047857",
                    transition: "all 0.15s ease",
                  }}
                >
                  Fully Cleared / Paid ({recurringFeesData.paidCount || 0})
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ position: "relative", minWidth: 260, maxWidth: 360, flex: 1 }}>
                <input
                  type="text"
                  placeholder={
                    isGym
                      ? "Search member name, slot, plan..."
                      : "Search student, roll #, phone, batch..."
                  }
                  value={feeSearchQuery}
                  onChange={(e) => setFeeSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 34px",
                    fontSize: 12.5,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                    pointerEvents: "none",
                  }}
                >
                  <Icon name="search" size={14} />
                </div>
                {feeSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setFeeSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          {loadingFees ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Calculating fee cycle dues…
            </div>
          ) : !recurringFeesData?.items?.length ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                background: "#fafbfd",
                borderRadius: 14,
                border: "1px dashed #cbd5e1",
                margin: "10px 0",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  color: "var(--brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <Icon name="finance" size={28} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 750, margin: "0 0 6px", color: "var(--ink)" }}>
                No active fee cycles
              </h3>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                No active {isGym ? "members" : "students"} enrolled for {recurringFeesData?.cycleMonthLabel || "this month"}.
              </p>
            </div>
          ) : (() => {
            const filteredFeeItems = recurringFeesData.items.filter((item) => {
              if (feeStatusFilter === "PENDING" && item.status === "PAID") return false;
              if (feeStatusFilter === "PAID" && item.status !== "PAID") return false;
              if (feeSearchQuery.trim()) {
                const q = feeSearchQuery.trim().toLowerCase();
                const matchName = item.displayName?.toLowerCase().includes(q);
                const matchRoll = item.rollNumber?.toLowerCase().includes(q);
                const matchPhone = item.guardianPhone?.toLowerCase().includes(q);
                const matchStandard = item.standard?.toLowerCase().includes(q);
                const matchBatch = item.batch?.toLowerCase().includes(q);
                const matchGuardian = item.guardianName?.toLowerCase().includes(q);
                if (!matchName && !matchRoll && !matchPhone && !matchStandard && !matchBatch && !matchGuardian) {
                  return false;
                }
              }
              return true;
            });

            if (filteredFeeItems.length === 0) {
              return (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    background: "#fafbfd",
                    borderRadius: 14,
                    border: "1px dashed #cbd5e1",
                    margin: "10px 0",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                    No fee records match current filters
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px" }}>
                    Try switching filter pills or clear your search term.
                  </p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setFeeStatusFilter("ALL");
                      setFeeSearchQuery("");
                    }}
                    style={{ padding: "6px 14px", fontSize: 12, borderRadius: 6 }}
                  >
                    Clear Filters
                  </button>
                </div>
              );
            }

            return (
              <div className="table-responsive" style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isGym ? "Member Details" : "Student Details"}</th>
                      <th>{isGym ? "Membership Plan & Slot" : "Standard & Batch"}</th>
                      <th>{isGym ? "Contact / Phone" : "Guardian Contact"}</th>
                      <th>{isGym ? "Fee Package" : "Monthly Plan"}</th>
                      <th>Fee Status</th>
                      <th>Paid Amount</th>
                      <th>Balance Due</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeeItems.map((item) => (
                      <tr key={item.studentProfileId}>
                        <td>
                          <strong style={{ fontSize: 13.5 }}>{item.displayName}</strong>
                          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>
                            {item.rollNumber ? `#${item.rollNumber}` : ""} · {item.cycleMonthLabel}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 650, fontSize: 13 }}>{item.standard}</div>
                          {item.batch && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{item.batch}</div>}
                        </td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{item.guardianName || (isGym ? item.displayName : "—")}</div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{item.guardianPhone || "—"}</div>
                        </td>
                      <td>
                        <strong style={{ color: "var(--ink)", fontSize: 13 }}>
                          {formatMoney(item.feePlanAmountMinor, currency)}
                        </strong>
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
                      <td style={{ fontSize: 13 }}>{formatMoney(item.paidMinor, currency)}</td>
                      <td>
                        <strong style={{ fontSize: 13, color: item.balanceMinor > 0 ? "#b45309" : "#047857" }}>
                          {formatMoney(item.balanceMinor, currency)}
                        </strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {item.status === "PAID" ? (
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: "#047857", fontWeight: 750 }}>
                              Received
                            </span>
                            {item.whatsappUrl && (
                              <a
                                href={item.whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-button"
                                style={{
                                  padding: "5px 9px",
                                  fontSize: 11.5,
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "#16a34a",
                                }}
                                title="Send WhatsApp Receipt / Update"
                              >
                                <Icon name="whatsapp" size={14} />
                              </a>
                            )}
                          </div>
                        ) : item.status === "PARTIALLY_PAID" ? (
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                            <button
                              className="primary-button"
                              style={{
                                padding: "6px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                borderRadius: 7,
                                background: "#d97706",
                                borderColor: "#d97706",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                              onClick={() => openCollectFeeModal(item)}
                            >
                              <Icon name="rupee" size={13} />
                              <span>Collect Due ({formatMoney(item.balanceMinor, currency)})</span>
                            </button>
                            {item.invoiceId && (
                              <a
                                href={`/pay/${item.invoiceId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-button"
                                style={{
                                  padding: "5px 9px",
                                  fontSize: 11.5,
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "#2563eb",
                                  borderColor: "#bfdbfe",
                                  background: "#eff6ff",
                                  fontWeight: 650,
                                }}
                                title="Open Online Checkout (Razorpay UPI/Cards)"
                              >
                                <Icon name="rupee" size={12} />
                                <span>Pay Link</span>
                              </a>
                            )}
                            {item.whatsappUrl && (
                              <a
                                href={item.whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-button"
                                style={{
                                  padding: "5px 9px",
                                  fontSize: 11.5,
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "#16a34a",
                                }}
                                title="Send WhatsApp Update"
                              >
                                <Icon name="whatsapp" size={14} />
                              </a>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                            <button
                              className="primary-button"
                              style={{
                                padding: "6px 14px",
                                fontSize: 12.5,
                                fontWeight: 700,
                                borderRadius: 7,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                              onClick={() => openCollectFeeModal(item)}
                            >
                              <Icon name="rupee" size={14} />
                              <span>Collect Fee</span>
                            </button>
                            {item.invoiceId && (
                              <a
                                href={`/pay/${item.invoiceId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-button"
                                style={{
                                  padding: "5px 9px",
                                  fontSize: 11.5,
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "#2563eb",
                                  borderColor: "#bfdbfe",
                                  background: "#eff6ff",
                                  fontWeight: 650,
                                }}
                                title="Open Online Checkout (Razorpay UPI/Cards)"
                              >
                                <Icon name="rupee" size={12} />
                                <span>Pay Link</span>
                              </a>
                            )}
                            {item.whatsappUrl && (
                              <a
                                href={item.whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-button"
                                style={{
                                  padding: "5px 9px",
                                  fontSize: 11.5,
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "#16a34a",
                                }}
                                title="Send WhatsApp Fee Reminder"
                              >
                                <Icon name="whatsapp" size={14} />
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            );
          })()}
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: DAILY FAST ATTENDANCE GRID                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "attendance" && (
        <section className="section-card" style={{ padding: "22px 26px" }}>
          <div
            className="section-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
              paddingBottom: 16,
              borderBottom: "1px solid #f1f5f9",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 750, margin: 0 }}>Daily Attendance Grid</h3>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 0" }}>
                1-Click Present / Absent / Leave marking for tuition classes, batches, and academies.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--brand)",
                  fontWeight: 700,
                  fontSize: 13,
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              />
              <select
                value={standardFilter}
                onChange={(e) => setStandardFilter(e.target.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 12.5,
                  background: "#ffffff",
                  fontWeight: 600,
                }}
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
                style={{
                  fontSize: 12.5,
                  padding: "7px 14px",
                  fontWeight: 700,
                  borderRadius: 8,
                  color: "#047857",
                  background: "#f0fdf4",
                  borderColor: "#bbf7d0",
                }}
              >
                Mark All Present
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleMarkAllAbsent}
                style={{
                  fontSize: 12.5,
                  padding: "7px 14px",
                  fontWeight: 700,
                  borderRadius: 8,
                  color: "#b91c1c",
                  background: "#fef2f2",
                  borderColor: "#fecaca",
                }}
              >
                Mark All Absent
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSaveAttendance}
                disabled={savingAttendance}
                style={{
                  fontSize: 12.5,
                  padding: "7px 16px",
                  fontWeight: 700,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="check" size={15} />
                <span>{savingAttendance ? "Saving…" : "Save Attendance"}</span>
              </button>
            </div>
          </div>

          {/* Live Attendance Tally */}
          {attendanceData && (
            <div
              style={{
                display: "flex",
                gap: 18,
                padding: "12px 18px",
                background: "#f8fafc",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                marginBottom: 18,
                fontSize: 12.5,
                fontWeight: 650,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "var(--ink)" }}>Total: {attendanceData.totalStudents} Students</span>
              <span style={{ color: "#047857" }}>• Present: {attendanceData.presentCount}</span>
              <span style={{ color: "#b91c1c" }}>• Absent: {attendanceData.absentCount}</span>
              <span style={{ color: "#b45309" }}>• Leave: {attendanceData.leaveCount}</span>
              <span style={{ marginLeft: "auto", fontWeight: 800, color: "var(--brand)", fontSize: 13 }}>
                Attendance Rate: {attendanceData.attendancePercentage}%
              </span>
            </div>
          )}

          {loadingAttendance ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Loading attendance sheet…
            </div>
          ) : !attendanceData?.items?.length ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                background: "#fafbfd",
                borderRadius: 14,
                border: "1px dashed #cbd5e1",
                margin: "10px 0",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  color: "var(--brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <Icon name="calendar" size={28} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 750, margin: "0 0 6px", color: "var(--ink)" }}>
                No students found for this date
              </h3>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                Admit students to begin logging daily attendance.
              </p>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Standard & Batch</th>
                    <th>Phone</th>
                    <th style={{ textAlign: "center" }}>Mark Attendance</th>
                    <th>Remarks / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.items.map((item) => {
                    const currentStatus = attendanceEdits[item.studentProfileId]?.status || "PRESENT";
                    const currentRemarks = attendanceEdits[item.studentProfileId]?.remarks || "";

                    return (
                      <tr key={item.studentProfileId}>
                        <td>
                          <strong style={{ fontSize: 13.5 }}>{item.displayName}</strong>
                          {item.rollNumber && (
                            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>
                              #{item.rollNumber}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 650, fontSize: 13 }}>{item.standard}</div>
                          {item.batch && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{item.batch}</div>}
                        </td>
                        <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{item.primaryPhone || "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              overflow: "hidden",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(item.studentProfileId, "PRESENT", item.displayName)}
                              style={{
                                padding: "6px 16px",
                                fontSize: 12,
                                fontWeight: currentStatus === "PRESENT" ? 750 : 550,
                                background: currentStatus === "PRESENT" ? "#047857" : "#ffffff",
                                color: currentStatus === "PRESENT" ? "#ffffff" : "var(--ink)",
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(item.studentProfileId, "ABSENT", item.displayName)}
                              style={{
                                padding: "6px 16px",
                                fontSize: 12,
                                fontWeight: currentStatus === "ABSENT" ? 750 : 550,
                                background: currentStatus === "ABSENT" ? "#b91c1c" : "#ffffff",
                                color: currentStatus === "ABSENT" ? "#ffffff" : "var(--ink)",
                                borderLeft: "1px solid #cbd5e1",
                                borderRight: "1px solid #cbd5e1",
                                borderTop: "none",
                                borderBottom: "none",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(item.studentProfileId, "LEAVE", item.displayName)}
                              style={{
                                padding: "6px 16px",
                                fontSize: 12,
                                fontWeight: currentStatus === "LEAVE" ? 750 : 550,
                                background: currentStatus === "LEAVE" ? "#b45309" : "#ffffff",
                                color: currentStatus === "LEAVE" ? "#ffffff" : "var(--ink)",
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              Leave
                            </button>
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="Optional remark…"
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
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #cbd5e1",
                              fontSize: 12,
                              width: "100%",
                              maxWidth: 240,
                              background: "#ffffff",
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
        <section className="section-card" style={{ padding: "22px 26px" }}>
          <div
            className="section-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
              paddingBottom: 16,
              borderBottom: "1px solid #f1f5f9",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 750, margin: 0 }}>
                Monthly Attendance & Working Days Summary
              </h3>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 0" }}>
                Total working days, present counts, and percentage per student.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--brand)",
                  fontWeight: 700,
                  fontSize: 13,
                  background: "#ffffff",
                }}
              />
            </div>
          </div>

          {loadingSummary ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Generating monthly summary…
            </div>
          ) : !attendanceSummary?.students?.length ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                background: "#fafbfd",
                borderRadius: 14,
                border: "1px dashed #cbd5e1",
                margin: "10px 0",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  color: "var(--brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <Icon name="reports" size={28} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 750, margin: "0 0 6px", color: "var(--ink)" }}>
                No attendance records
              </h3>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                No attendance logs found for {attendanceSummary?.monthLabel || "this month"}.
              </p>
            </div>
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
                    <th>Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceSummary.students.map((st) => (
                    <tr key={st.studentProfileId}>
                      <td>
                        <strong style={{ fontSize: 13.5 }}>{st.displayName}</strong>
                        {st.rollNumber && (
                          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>
                            #{st.rollNumber}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 650, fontSize: 13 }}>{st.standard}</div>
                        {st.batch && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{st.batch}</div>}
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{st.totalWorkingDays}</td>
                      <td style={{ color: "#047857", fontWeight: 750, fontSize: 13 }}>{st.presentDays}</td>
                      <td style={{ color: "#b91c1c", fontSize: 13 }}>{st.absentDays}</td>
                      <td style={{ color: "#b45309", fontSize: 13 }}>{st.leaveDays}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 90,
                              height: 7,
                              borderRadius: 4,
                              background: "#e2e8f0",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, st.percentage)}%`,
                                height: "100%",
                                background:
                                  st.percentage >= 75 ? "#047857" : st.percentage >= 50 ? "#b45309" : "#b91c1c",
                              }}
                            />
                          </div>
                          <strong style={{ fontSize: 12.5, color: "var(--ink)" }}>{st.percentage}%</strong>
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
        title={isGym ? "New Member Admission & Package Enrollment" : "New Student Admission & Enrollment"}
        subtitle={isGym ? "Create member profile, gym package, workout slot, emergency contact, and fee plan." : "Create permanent student record, course batch, guardian contact, and recurring fee plan."}
        maxWidth={780}
      >
        <form onSubmit={handleSaveAdmission}>
          {admissionError && (
            <div
              style={{
                padding: "12px 16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#991b1b",
                fontSize: 13,
                marginBottom: 16,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon name="alertCircle" size={16} />
              <span>{admissionError}</span>
            </div>
          )}

          {/* Section 1: Basic & Contact Details */}
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: "var(--ink)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="people" size={14} /> {isGym ? "Member Profile & Contact" : "Student Profile & Contact"}
            </div>
            <div className="form-grid-2">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  {isGym ? "Member Full Name *" : "Student Full Name *"}
                </label>
                <input
                  type="text"
                  placeholder={isGym ? "e.g. Rahul Sharma" : "e.g. Aryan Sharma"}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    height: 40,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  {isGym ? "Member Mobile Number *" : "Student Mobile Number"}
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  required={isGym}
                  style={{
                    width: "100%",
                    height: 40,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  {isGym ? "Member ID / Reg No (Auto-Generated)" : "Student ID / Roll Number"}
                </label>
                <input
                  type="text"
                  placeholder={isGym ? "Auto-generated (e.g. GYM-1001)" : "e.g. STD-101 (leave blank for auto)"}
                  value={formRollNumber}
                  onChange={(e) => setFormRollNumber(e.target.value)}
                  style={{
                    width: "100%",
                    height: 40,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  Email ID (Optional)
                </label>
                <input
                  type="email"
                  placeholder={isGym ? "member@example.com" : "student@example.com"}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  style={{
                    width: "100%",
                    height: 40,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Membership Package OR Academic Batch */}
          <div
            style={{
              padding: "16px 18px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: "#1e40af",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="activity" size={14} />{" "}
              {isGym ? "Membership Package & Workout Slot" : "Class / Course & Batch Allocation"}
            </div>

            {isGym ? (
              <div>
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                      Membership Plan / Package *
                    </label>
                    <select
                      value={formStandard}
                      onChange={(e) => setFormStandard(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        height: 40,
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        background: "#ffffff",
                        fontWeight: 650,
                      }}
                    >
                      <option value="General Gym (Weights & Cardio)">General Gym (Weights & Cardio)</option>
                      <option value="Cardio & CrossFit / HIIT">Cardio & CrossFit / HIIT</option>
                      <option value="Personal Training (1-on-1 PT)">Personal Training (1-on-1 PT)</option>
                      <option value="Strength & Bodybuilding">Strength & Bodybuilding</option>
                      <option value="Yoga & Zumba Studio">Yoga & Zumba Studio</option>
                      <option value="Custom Plan">Custom Package Plan</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                      Workout Slot / Timing Shift
                    </label>
                    <select
                      value={formBatch}
                      onChange={(e) => setFormBatch(e.target.value)}
                      style={{
                        width: "100%",
                        height: 40,
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        background: "#ffffff",
                        fontWeight: 600,
                      }}
                    >
                      <option value="Full Day Flexible Access">Full Day Flexible Access (6 AM - 10 PM)</option>
                      <option value="Morning Slot (6:00 AM - 10:00 AM)">Morning Slot (6:00 AM - 10:00 AM)</option>
                      <option value="Afternoon Slot (12:00 PM - 4:00 PM)">Afternoon Slot (12:00 PM - 4:00 PM)</option>
                      <option value="Evening Slot (5:00 PM - 10:00 PM)">Evening Slot (5:00 PM - 10:00 PM)</option>
                      <option value="Night Slot (8:00 PM - 11:00 PM)">Night Slot (8:00 PM - 11:00 PM)</option>
                      <option value="Weekend Only Access">Weekend Only Access</option>
                    </select>
                  </div>
                </div>

                {formStandard === "Custom Plan" && (
                  <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                      Custom Plan Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 6 Months Transformation Bootcamp + Diet Plan"
                      value={customStandard}
                      onChange={(e) => setCustomStandard(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        height: 40,
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        background: "#ffffff",
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="form-grid-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                    Class / Course / Standard *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10th Standard, Dance Batch A, Martial Arts"
                    value={formStandard}
                    onChange={(e) => setFormStandard(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      height: 40,
                      boxSizing: "border-box",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      background: "#ffffff",
                    }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                    Batch Timing / Shift
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Morning 8:00 AM, Evening Shift"
                    value={formBatch}
                    onChange={(e) => setFormBatch(e.target.value)}
                    style={{
                      width: "100%",
                      height: 40,
                      boxSizing: "border-box",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Guardian / Emergency Contact */}
          <div
            style={{
              padding: "16px 18px",
              background: isGym ? "#f8fafc" : "#f0fdf4",
              border: isGym ? "1px solid #e2e8f0" : "1px solid #bbf7d0",
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: isGym ? "#334155" : "#166534",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="phone" size={14} />{" "}
              {isGym
                ? "Emergency Contact & Reference (Optional)"
                : "Guardian Contact (For Automated WhatsApp & PDF Receipts)"}
            </div>
            <div className="form-grid-3">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: isGym ? "#334155" : "#166534" }}>
                  {isGym ? "Contact Person Name" : "Guardian Name"}
                </label>
                <input
                  type="text"
                  placeholder={isGym ? "e.g. Amit (Friend/Brother)" : "e.g. Rajesh Sharma"}
                  value={formGuardianName}
                  onChange={(e) => setFormGuardianName(e.target.value)}
                  style={{
                    width: "100%",
                    height: 40,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: isGym ? "1px solid #cbd5e1" : "1px solid #86efac",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: isGym ? "#334155" : "#166534" }}>
                  {isGym ? "Emergency Mobile" : "Guardian Mobile *"}
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={formGuardianPhone}
                  onChange={(e) => setFormGuardianPhone(e.target.value)}
                  style={{
                    width: "100%",
                    height: 40,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: isGym ? "1px solid #cbd5e1" : "1px solid #86efac",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: isGym ? "#334155" : "#166534" }}>
                  Relation
                </label>
                <select
                  value={formGuardianRelation}
                  onChange={(e) => setFormGuardianRelation(e.target.value)}
                  style={{
                    width: "100%",
                    height: 40,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: isGym ? "1px solid #cbd5e1" : "1px solid #86efac",
                    fontSize: 13,
                    background: "#ffffff",
                    fontWeight: 600,
                  }}
                >
                  <option value="Self">Self</option>
                  <option value="Friend">Friend</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Recurring Fee / Term Installment Plan */}
          <div
            style={{
              padding: "16px 18px",
              background: "#fefce8",
              border: "1px solid #fef08a",
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: "#854d0e",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="rupee" size={14} />{" "}
                {isGym ? "Membership Fee & Validity Plan" : "Fee Plan & Billing Structure"}
              </span>

              {/* Plan Choice Pills - Hidden for gym */}
              {!isGym && (
                <div style={{ display: "inline-flex", background: "#ffffff", padding: "2px", borderRadius: 8, border: "1px solid #fde047" }}>
                  <button
                    type="button"
                    onClick={() => setFeePlanType("MONTHLY")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 6,
                      border: "none",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: feePlanType === "MONTHLY" ? "#854d0e" : "transparent",
                      color: feePlanType === "MONTHLY" ? "#ffffff" : "#854d0e",
                    }}
                  >
                    Monthly Recurring
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeePlanType("TERM_INSTALLMENTS")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 6,
                      border: "none",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: feePlanType === "TERM_INSTALLMENTS" ? "#854d0e" : "transparent",
                      color: feePlanType === "TERM_INSTALLMENTS" ? "#ffffff" : "#854d0e",
                    }}
                  >
                    3-Term Installments (Term 1, 2, 3)
                  </button>
                </div>
              )}
            </div>

            {isGym || feePlanType === "MONTHLY" ? (
              (() => {
                const now = new Date();
                const currentYyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                const monthLabels = [
                  { short: "Jan", full: "January" },
                  { short: "Feb", full: "February" },
                  { short: "Mar", full: "March" },
                  { short: "Apr", full: "April" },
                  { short: "May", full: "May" },
                  { short: "Jun", full: "June" },
                  { short: "Jul", full: "July" },
                  { short: "Aug", full: "August" },
                  { short: "Sep", full: "September" },
                  { short: "Oct", full: "October" },
                  { short: "Nov", full: "November" },
                  { short: "Dec", full: "December" },
                ];

                const selectedSorted = [...admissionSelectedMonths].sort();
                const selectedLabels = selectedSorted.map((ym) => {
                  const [y, m] = ym.split("-");
                  const idx = parseInt(m || "1", 10) - 1;
                  return `${monthLabels[idx]?.short || m || ""} ${y || ""}`;
                });

                return (
                  <div>
                    {/* 12-Month Calendar Header & Year Switcher */}
                    <div
                      className="calendar-header-responsive"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                        paddingBottom: 8,
                        borderBottom: "1px solid #fef08a",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 750, color: "#854d0e", display: "block" }}>
                          12-Month Plan Validity & Fee Calendar
                        </label>
                        <span style={{ fontSize: 11.5, color: "#a16207" }}>
                          {isGym
                            ? "Click months to mark membership validity. Selected months automatically set the Plan Validity & Cycle."
                            : "Click months to mark fee coverage. Selected months automatically set the billing validity cycle."}
                        </span>
                      </div>

                      {/* Year Switcher */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setAdmissionYear((y) => y - 1)}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: "1px solid #fde047",
                            background: "#ffffff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            color: "#854d0e",
                          }}
                        >
                          &lt; {admissionYear - 1}
                        </button>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            padding: "4px 10px",
                            background: "#fef9c3",
                            color: "#854d0e",
                            borderRadius: 6,
                            border: "1px solid #fde047",
                          }}
                        >
                          Year {admissionYear}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAdmissionYear((y) => y + 1)}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: "1px solid #fde047",
                            background: "#ffffff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            color: "#854d0e",
                          }}
                        >
                          {admissionYear + 1} &gt;
                        </button>
                      </div>
                    </div>

                    {/* Quick Select Buttons */}
                    <div className="quick-mark-row" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#854d0e" }}>Quick Mark:</span>
                      {[
                        { count: 1, label: "+ 1 Month" },
                        { count: 2, label: "+ 2 Months" },
                        { count: 3, label: "+ 3 Months (Quarterly)" },
                        { count: 6, label: "+ 6 Months (Half-Year)" },
                        { count: 12, label: "+ 12 Months (1 Year)" },
                      ].map((opt) => (
                        <button
                          key={opt.count}
                          type="button"
                          onClick={() => quickSelectAdmissionMonths(opt.count)}
                          style={{
                            padding: "4px 9px",
                            borderRadius: 6,
                            border: "1px solid #fde047",
                            background: "#ffffff",
                            fontSize: 11,
                            fontWeight: 650,
                            cursor: "pointer",
                            color: "#854d0e",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                      {admissionSelectedMonths.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAdmissionSelectedMonths([]);
                            setFormPlanMonths(1);
                            setFormFeeFrequency("MONTHLY");
                          }}
                          style={{
                            padding: "4px 9px",
                            borderRadius: 6,
                            border: "1px solid #fecaca",
                            background: "#fff1f2",
                            fontSize: 11,
                            fontWeight: 650,
                            cursor: "pointer",
                            color: "#b91c1c",
                            marginLeft: "auto",
                          }}
                        >
                          Clear Marked
                        </button>
                      )}
                    </div>

                    {/* 12 Months Grid */}
                    <div className="calendar-month-grid">
                      {monthLabels.map((item, idx) => {
                        const mNumStr = String(idx + 1).padStart(2, "0");
                        const yyyyMm = `${admissionYear}-${mNumStr}`;
                        const isCurrent = yyyyMm === currentYyyyMm;
                        const isSelected = admissionSelectedMonths.includes(yyyyMm);

                        let bg = "#ffffff";
                        let border = "1px solid #cbd5e1";
                        let textColor = "#1e293b";
                        let shadow = "none";

                        if (isSelected) {
                          bg = "#eff6ff";
                          border = "2px solid #2563eb";
                          textColor = "#1d4ed8";
                          shadow = "0 2px 6px rgba(37, 99, 235, 0.15)";
                        } else if (isCurrent) {
                          bg = "#fffbeb";
                          border = "1.5px solid #f59e0b";
                          textColor = "#92400e";
                        }

                        return (
                          <div
                            key={yyyyMm}
                            onClick={() => toggleAdmissionMonth(yyyyMm)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              background: bg,
                              border,
                              boxShadow: shadow,
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              minHeight: 52,
                              transition: "all 0.15s ease",
                              userSelect: "none",
                              boxSizing: "border-box",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12.5, fontWeight: 750, color: textColor }}>
                                {item.short} {admissionYear}
                              </span>
                              {isCurrent && !isSelected && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    background: "#fef3c7",
                                    color: "#92400e",
                                    border: "1px solid #fde68a",
                                    padding: "1px 4px",
                                    borderRadius: 3,
                                  }}
                                >
                                  CURRENT
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 750,
                                  color: isSelected ? "#2563eb" : "#94a3b8",
                                }}
                              >
                                {isSelected ? "Marked" : "Select"}
                              </span>
                              {isSelected && (
                                <span style={{ fontSize: 10, fontWeight: 800, color: "#2563eb" }}>
                                  ✓
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Marked Months & Validity Summary Banner */}
                    {admissionSelectedMonths.length > 0 ? (
                      <div
                        style={{
                          padding: "10px 14px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          borderRadius: 8,
                          marginBottom: 14,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 750, color: "#1d4ed8" }}>
                            Marked {admissionSelectedMonths.length} Month{admissionSelectedMonths.length > 1 ? "s" : ""}: {selectedLabels.join(", ")}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#3b82f6", marginTop: 2 }}>
                            Plan Validity: <strong>{admissionSelectedMonths.length} Month{admissionSelectedMonths.length > 1 ? "s" : ""}</strong> ({admissionSelectedMonths.length === 3 ? "Quarterly" : admissionSelectedMonths.length === 6 ? "Half-Yearly" : admissionSelectedMonths.length === 12 ? "Annual" : `${admissionSelectedMonths.length} Months Plan`}) · Saved to member profile & fee cycle
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 800,
                            padding: "3px 10px",
                            borderRadius: 6,
                            background: "#2563eb",
                            color: "#ffffff",
                          }}
                        >
                          {admissionSelectedMonths.length} Month Cycle
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: "8px 12px",
                          background: "#fffbeb",
                          border: "1px dashed #fde68a",
                          borderRadius: 8,
                          marginBottom: 14,
                          fontSize: 12,
                          color: "#92400e",
                        }}
                      >
                        No months marked yet. Click any month or use Quick Mark buttons above to set the plan validity cycle.
                      </div>
                    )}

                    {/* Manual Fee and Date Inputs Row */}
                    <div>
                      <div className="form-grid-fees">
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "#854d0e" }}>
                            {isGym ? "Total Membership Fee (₹) *" : "Total Fee Amount (₹) *"}
                          </label>
                          <input
                            type="number"
                            name="membership_fee_amount_manual"
                            autoComplete="new-password"
                            autoCorrect="off"
                            data-lpignore="true"
                            data-form-type="other"
                            placeholder={isGym ? "Enter membership fee (e.g. 5000)" : "Enter fee amount"}
                            value={formFeeAmount}
                            onChange={(e) => setFormFeeAmount(e.target.value)}
                            required
                            style={{
                              width: "100%",
                              height: 40,
                              boxSizing: "border-box",
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid #fde047",
                              fontSize: 13,
                              background: "#ffffff",
                              MozAppearance: "textfield",
                              appearance: "textfield",
                            }}
                          />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "#854d0e" }}>
                            {isGym ? "Joining Date" : "Admission Date"}
                          </label>
                          <input
                            type="date"
                            value={formAdmissionDate}
                            onChange={(e) => setFormAdmissionDate(e.target.value)}
                            style={{
                              width: "100%",
                              height: 40,
                              boxSizing: "border-box",
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid #fde047",
                              fontSize: 13,
                              background: "#ffffff",
                            }}
                          />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "#854d0e" }}>
                            Plan Validity / Cycle
                          </label>
                          <select
                            value={formPlanMonths}
                            onChange={(e) => {
                              const count = parseInt(e.target.value, 10);
                              setFormPlanMonths(count);
                              if (count === 12) setFormFeeFrequency("ANNUAL");
                              else if (count === 3) setFormFeeFrequency("QUARTERLY");
                              else setFormFeeFrequency("MONTHLY");
                              quickSelectAdmissionMonths(count);
                            }}
                            style={{
                              width: "100%",
                              height: 40,
                              boxSizing: "border-box",
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid #fde047",
                              fontSize: 13,
                              background: "#ffffff",
                              fontWeight: 650,
                              color: "#854d0e",
                            }}
                          >
                            <option value={1}>1 Month (Monthly)</option>
                            <option value={2}>2 Months Plan</option>
                            <option value={3}>3 Months (Quarterly)</option>
                            <option value={4}>4 Months Plan</option>
                            <option value={5}>5 Months Plan</option>
                            <option value={6}>6 Months (Half-Yearly)</option>
                            <option value={7}>7 Months Plan</option>
                            <option value={8}>8 Months Plan</option>
                            <option value={9}>9 Months Plan</option>
                            <option value={10}>10 Months Plan</option>
                            <option value={11}>11 Months Plan</option>
                            <option value={12}>12 Months (1 Year / Annual)</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#a16207", marginTop: 6 }}>
                        Manual Fee: Enter agreed amount. No automatic multiplication or hidden charges.
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#713f12" }}>
                  Annual academic fee is divided into 3 flexible term installments. Each installment has its own due date.
                </p>
                <div className="term-installments-grid">
                  {/* Term 1 */}
                  <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #fde047" }}>
                    <strong style={{ fontSize: 12, color: "#854d0e", display: "block", marginBottom: 8 }}>
                      Term 1 (Admission)
                    </strong>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: "#713f12", display: "block", marginBottom: 4 }}>Amount (₹)</label>
                    <input
                      type="number"
                      value={term1Amount}
                      onChange={(e) => setTerm1Amount(e.target.value)}
                      required
                      style={{ width: "100%", height: 38, padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12.5, marginBottom: 8, boxSizing: "border-box" }}
                    />
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: "#713f12", display: "block", marginBottom: 4 }}>Due Date</label>
                    <input
                      type="date"
                      value={term1DueDate}
                      onChange={(e) => setTerm1DueDate(e.target.value)}
                      required
                      style={{ width: "100%", height: 38, padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Term 2 */}
                  <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #fde047" }}>
                    <strong style={{ fontSize: 12, color: "#854d0e", display: "block", marginBottom: 8 }}>
                      Term 2 (Mid-Term)
                    </strong>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: "#713f12", display: "block", marginBottom: 4 }}>Amount (₹)</label>
                    <input
                      type="number"
                      value={term2Amount}
                      onChange={(e) => setTerm2Amount(e.target.value)}
                      required
                      style={{ width: "100%", height: 38, padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12.5, marginBottom: 8, boxSizing: "border-box" }}
                    />
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: "#713f12", display: "block", marginBottom: 4 }}>Due Date</label>
                    <input
                      type="date"
                      value={term2DueDate}
                      onChange={(e) => setTerm2DueDate(e.target.value)}
                      required
                      style={{ width: "100%", height: 38, padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Term 3 */}
                  <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #fde047" }}>
                    <strong style={{ fontSize: 12, color: "#854d0e", display: "block", marginBottom: 8 }}>
                      Term 3 (Final Term)
                    </strong>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: "#713f12", display: "block", marginBottom: 4 }}>Amount (₹)</label>
                    <input
                      type="number"
                      value={term3Amount}
                      onChange={(e) => setTerm3Amount(e.target.value)}
                      required
                      style={{ width: "100%", height: 38, padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12.5, marginBottom: 8, boxSizing: "border-box" }}
                    />
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: "#713f12", display: "block", marginBottom: 4 }}>Due Date</label>
                    <input
                      type="date"
                      value={term3DueDate}
                      onChange={(e) => setTerm3DueDate(e.target.value)}
                      required
                      style={{ width: "100%", height: 38, padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px dashed #fde047", fontSize: 12 }}>
                  <span style={{ color: "#713f12", fontWeight: 650 }}>Total Academic Annual Fee:</span>
                  <strong style={{ fontSize: 14, color: "#854d0e" }}>
                    ₹{((Number(term1Amount) || 0) + (Number(term2Amount) || 0) + (Number(term3Amount) || 0)).toLocaleString("en-IN")}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Initial Enrollment Payment Status (PAID vs PENDING) */}
          <div
            style={{
              padding: "16px 18px",
              background: admissionPaymentStatus === "PAID_NOW" ? "#f0fdf4" : "#fffbeb",
              border: admissionPaymentStatus === "PAID_NOW" ? "1px solid #86efac" : "1px solid #fed7aa",
              borderRadius: 10,
              marginBottom: 16,
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: admissionPaymentStatus === "PAID_NOW" ? "#166534" : "#9a3412",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="checkCircle" size={14} /> Fee Payment at Admission
              </span>

              <div style={{ display: "inline-flex", background: "#ffffff", padding: "2px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                <button
                  type="button"
                  onClick={() => setAdmissionPaymentStatus("PAID_NOW")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: admissionPaymentStatus === "PAID_NOW" ? "#16a34a" : "transparent",
                    color: admissionPaymentStatus === "PAID_NOW" ? "#ffffff" : "#166534",
                  }}
                >
                  Paid Now (Cleared)
                </button>
                <button
                  type="button"
                  onClick={() => setAdmissionPaymentStatus("PENDING")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: admissionPaymentStatus === "PENDING" ? "#ea580c" : "transparent",
                    color: admissionPaymentStatus === "PENDING" ? "#ffffff" : "#9a3412",
                  }}
                >
                  Pay Later (Pending Due)
                </button>
              </div>
            </div>

            {admissionPaymentStatus === "PAID_NOW" ? (
              <div>
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "#166534" }}>
                      Payment Mode *
                    </label>
                    <select
                      value={admissionPaymentMethod}
                      onChange={(e) => setAdmissionPaymentMethod(e.target.value)}
                      style={{
                        width: "100%",
                        height: 40,
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #86efac",
                        fontSize: 13,
                        background: "#ffffff",
                        fontWeight: 650,
                      }}
                    >
                      <option value="UPI">UPI (GooglePay / PhonePe / Paytm / QR)</option>
                      <option value="CASH">Cash in Hand</option>
                      <option value="CARD">Credit / Debit Card (POS)</option>
                      <option value="BANK_TRANSFER">Direct Bank Transfer / NEFT / IMPS</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "#166534" }}>
                      Amount Received (₹) *
                    </label>
                    <input
                      type="number"
                      name="admission_amount_received_manual"
                      autoComplete="new-password"
                      autoCorrect="off"
                      data-lpignore="true"
                      data-form-type="other"
                      placeholder="Enter amount received (e.g. 5000)"
                      value={admissionAmountPaid}
                      onChange={(e) => setAdmissionAmountPaid(e.target.value)}
                      style={{
                        width: "100%",
                        height: 40,
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #86efac",
                        fontSize: 13,
                        background: "#ffffff",
                        fontWeight: 700,
                        color: "#166534",
                      }}
                    />
                  </div>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#15803d" }}>
                  <strong>Instant Cleared Status:</strong> An official invoice will be generated and marked <strong>PAID</strong> immediately upon saving.
                </p>
              </div>
            ) : (
              <div style={{ padding: "8px 12px", background: "#fff7ed", borderRadius: 8, border: "1px solid #ffedd5", fontSize: 12.5, color: "#9a3412" }}>
                {isGym ? "Member" : "Student"} will be admitted with fee marked as <strong>PENDING DUE</strong>. You can collect fee or send reminder anytime from Upcoming Fees tab.
              </div>
            )}
          </div>

          {/* Section 6: Address */}
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: "var(--ink)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="building" size={14} /> Address (Optional)
            </div>
            <div className="form-grid-address">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  Street Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Flat 101, Galaxy Heights"
                  value={formStreet}
                  onChange={(e) => setFormStreet(e.target.value)}
                  style={{
                    width: "100%",
                    height: 40,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  style={{
                    width: "100%",
                    height: 40,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  State
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  style={{
                    width: "100%",
                    height: 40,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons in Sticky Modal Footer */}
          <div className="modal-sticky-footer modal-sticky-footer-responsive" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAdmissionModalOpen(false)}
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 650,
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={admissionBusy}
              style={{
                height: 40,
                padding: "0 22px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              {admissionBusy
                ? (isGym ? "Enrolling Member…" : "Admitting Student…")
                : (isGym ? "Save Member Enrollment" : "Save Admission & Permanent Profile")}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: EDIT EXISTING STUDENT / MEMBER PROFILE                 */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={isGym ? `Edit Member: ${editingStudent?.person.displayName || "Profile"}` : `Edit Student: ${editingStudent?.person.displayName || "Profile"}`}
        subtitle={isGym ? "Update membership allocation, contact numbers, emergency contact, and fee plan." : "Update academic allocation, contact numbers, guardian information, and recurring fee plan."}
        maxWidth={780}
      >
        <form onSubmit={handleSaveEditStudent}>
          {editError && (
            <div
              style={{
                padding: "12px 16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#991b1b",
                fontSize: 13,
                marginBottom: 16,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon name="alertCircle" size={16} />
              <span>{editError}</span>
            </div>
          )}

          {/* Section 1: Basic & Contact Details */}
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: "var(--ink)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="people" size={14} /> {isGym ? "Member Profile & Contact" : "Student Profile & Contact"}
            </div>
            <div className="form-grid-2">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  {isGym ? "Member Full Name *" : "Student Full Name *"}
                </label>
                <input
                  type="text"
                  placeholder={isGym ? "e.g. Rahul Sharma" : "e.g. Aryan Sharma"}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  {isGym ? "Member Mobile Number" : "Student Mobile Number"}
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            <div className="form-grid-3" style={{ marginTop: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  {isGym ? "Member ID / Reg No" : "Student ID / Roll Number"}
                </label>
                <input
                  type="text"
                  placeholder={isGym ? "e.g. GYM-101" : "e.g. STD-101"}
                  value={formRollNumber}
                  onChange={(e) => setFormRollNumber(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  Alternate Phone
                </label>
                <input
                  type="tel"
                  placeholder="Optional alternate phone"
                  value={formAltPhone}
                  onChange={(e) => setFormAltPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  Email ID (for Fee Receipts)
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Academic & Batch Allocation */}
          <div
            style={{
              padding: "16px 18px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: "var(--ink)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="activity" size={14} /> {isGym ? "Membership Package & Slot" : "Class & Batch Allocation"}
            </div>
            <div className="form-grid-3">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  {isGym ? "Membership Plan / Package *" : "Standard / Class *"}
                </label>
                <input
                  type="text"
                  placeholder={isGym ? "e.g. General Gym, CrossFit" : "e.g. 10th Standard"}
                  value={formStandard}
                  onChange={(e) => setFormStandard(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  {isGym ? "Workout Slot / Shift" : "Section / Batch"}
                </label>
                <input
                  type="text"
                  placeholder={isGym ? "e.g. Morning 6 AM, Evening Shift" : "e.g. Morning Batch"}
                  value={formBatch}
                  onChange={(e) => setFormBatch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  Enrollment Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    background: "#ffffff",
                    fontWeight: 650,
                  }}
                >
                  <option value="ACTIVE">{isGym ? "Active Member" : "Active Student"}</option>
                  <option value="INACTIVE">{isGym ? "Inactive / Expired" : "Inactive / Alumni"}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Guardian Details */}
          <div
            style={{
              padding: "16px 18px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: "#166534",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="people" size={14} /> {isGym ? "Emergency Contact & Reference" : "Parent & Guardian (WhatsApp Receipts)"}
            </div>
            <div className="form-grid-3">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#166534" }}>
                  {isGym ? "Contact Person Name" : "Guardian Name"}
                </label>
                <input
                  type="text"
                  placeholder={isGym ? "e.g. Ramesh (Friend/Brother)" : "e.g. Ramesh Sharma"}
                  value={formGuardianName}
                  onChange={(e) => setFormGuardianName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #86efac",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#166534" }}>
                  Relationship
                </label>
                <select
                  value={formGuardianRelation}
                  onChange={(e) => setFormGuardianRelation(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #86efac",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                >
                  <option value="Self">Self</option>
                  <option value="Friend">Friend</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#166534" }}>
                  {isGym ? "Emergency Mobile" : "Guardian WhatsApp Mobile"}
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={formGuardianPhone}
                  onChange={(e) => setFormGuardianPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #86efac",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Fee Plan */}
          <div
            style={{
              padding: "16px 18px",
              background: "#fefce8",
              border: "1px solid #fef08a",
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: "#854d0e",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="rupee" size={14} /> {isGym ? "Membership Fee Plan" : "Recurring Fee Plan"}
            </div>
            <div className="form-grid-2">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#854d0e" }}>
                  {isGym ? "Plan Cycle / Frequency" : "Billing Frequency"}
                </label>
                {isGym ? (
                  <select
                    value={formPlanMonths}
                    onChange={(e) => {
                      const m = parseInt(e.target.value, 10);
                      setFormPlanMonths(m);
                      if (m === 12) setFormFeeFrequency("ANNUAL");
                      else if (m === 3) setFormFeeFrequency("QUARTERLY");
                      else setFormFeeFrequency("MONTHLY");
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #fde047",
                      fontSize: 13,
                      background: "#ffffff",
                      fontWeight: 600,
                    }}
                  >
                    <option value={1}>1 Month (Monthly)</option>
                    <option value={2}>2 Months Plan</option>
                    <option value={3}>3 Months (Quarterly)</option>
                    <option value={4}>4 Months Plan</option>
                    <option value={5}>5 Months Plan</option>
                    <option value={6}>6 Months (Half-Yearly)</option>
                    <option value={7}>7 Months Plan</option>
                    <option value={8}>8 Months Plan</option>
                    <option value={9}>9 Months Plan</option>
                    <option value={10}>10 Months Plan</option>
                    <option value={11}>11 Months Plan</option>
                    <option value={12}>12 Months (1 Year / Annual)</option>
                  </select>
                ) : (
                  <select
                    value={formFeeFrequency}
                    onChange={(e) => setFormFeeFrequency(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #fde047",
                      fontSize: 13,
                      background: "#ffffff",
                      fontWeight: 600,
                    }}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUAL">Annual</option>
                  </select>
                )}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#854d0e" }}>
                  {isGym ? "Membership Fee (₹) *" : "Monthly Fee Amount (₹) *"}
                </label>
                <input
                  type="number"
                  placeholder={isGym ? "1500" : "5000"}
                  value={formFeeAmount}
                  onChange={(e) => setFormFeeAmount(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #fde047",
                    fontSize: 13,
                    background: "#ffffff",
                    MozAppearance: "textfield",
                    appearance: "textfield",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 5: Address & Notes */}
          <div style={{ marginBottom: 18 }}>
            <div className="form-grid-address">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>Street Address</label>
                <input
                  type="text"
                  placeholder=""
                  value={formStreet}
                  onChange={(e) => setFormStreet(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>City</label>
                <input
                  type="text"
                  placeholder=""
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>State</label>
                <input
                  type="text"
                  placeholder=""
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                  }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Internal Notes / Remarks</label>
              <textarea
                placeholder="Internal academic or fee remarks..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 12.5,
                }}
              />
            </div>
          </div>

          {/* Action Buttons in Sticky Modal Footer */}
          <div className="modal-sticky-footer modal-sticky-footer-responsive">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setEditModalOpen(false)}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={editBusy}
              style={{
                padding: "9px 22px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                cursor: "pointer",
              }}
            >
              {editBusy ? "Saving Changes…" : isGym ? "Update Member Profile" : "Save Student Changes"}
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
        title="1-Click Student Fee Collection"
        subtitle="Record fee collection, generate official receipt, and advance rolling fee cycle."
        maxWidth={540}
      >
        {receiptSuccessData ? (
          <div style={{ textAlign: "center", padding: "10px 0 16px" }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                background: "#dcfce7",
                color: "#166534",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px auto",
              }}
            >
              <Icon name="checkCircle" size={32} />
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 750, color: "var(--ink)" }}>
              Fee Payment Recorded!
            </h3>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 16px" }}>
              Official receipt <strong>{receiptSuccessData.receiptNumber}</strong> generated for {receiptSuccessData.monthLabel}.
            </p>

            <div style={{ background: "#f8fafc", borderRadius: 8, padding: 14, border: "1px solid #e2e8f0", marginBottom: 18, textAlign: "left", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Amount Paid Now:</span>
                <strong style={{ color: "#16a34a" }}>{formatMoney(receiptSuccessData.amountPaidMinor || 0, currency)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Remaining Balance Due:</span>
                <strong style={{ color: (receiptSuccessData.balanceDueMinor || 0) > 0 ? "#b45309" : "#16a34a" }}>
                  {(receiptSuccessData.balanceDueMinor || 0) > 0 ? formatMoney(receiptSuccessData.balanceDueMinor || 0, currency) : "₹0 (Fully Cleared)"}
                </strong>
              </div>
              {receiptSuccessData.emailSent && receiptSuccessData.emailTarget && (
                <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 8, marginTop: 8, color: "#2563eb", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="reports" size={14} />
                  <span>Fee receipt automatically emailed to <strong>{receiptSuccessData.emailTarget}</strong></span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                    padding: "11px 18px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13.5,
                    boxShadow: "0 4px 14px rgba(37, 211, 102, 0.35)",
                    color: "#ffffff",
                  }}
                >
                  <Icon name="whatsapp" size={18} />
                  <span>Send Fee Receipt on WhatsApp</span>
                </a>
              )}
              <button
                type="button"
                className="secondary-button"
                style={{
                  justifyContent: "center",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 650,
                }}
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
                  padding: "14px 16px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 14.5, color: "var(--ink)" }}>{collectFeeStudent.displayName}</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {collectFeeStudent.standard} {collectFeeStudent.batch ? `· ${collectFeeStudent.batch}` : ""}
                    </div>
                  </div>
                  <Badge tone={collectFeeStudent.status === "PAID" ? "green" : collectFeeStudent.status === "PARTIALLY_PAID" ? "amber" : "neutral"}>
                    {collectFeeStudent.cycleMonthLabel}
                  </Badge>
                </div>

                <div className="term-installments-grid" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #cbd5e1", fontSize: 12.5 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Monthly Plan</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                      {formatMoney(collectFeeStudent.feePlanAmountMinor, currency)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Already Paid</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>
                      {formatMoney(collectFeeStudent.paidMinor, currency)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Balance Due</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: collectFeeStudent.balanceMinor > 0 ? "#b45309" : "#16a34a" }}>
                      {formatMoney(collectFeeStudent.balanceMinor, currency)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 12-Month Calendar Section Header & Year Switcher */}
              <div
                className="calendar-header-responsive"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  paddingBottom: 8,
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <label style={{ fontSize: 13, fontWeight: 750, color: "var(--ink)", display: "block" }}>
                    12-Month Fee Calendar
                  </label>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    Click any unpaid month to mark it for payment
                  </span>
                </div>

                {/* Year Switcher */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setCollectFeeYear((y) => y - 1)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "#475569",
                    }}
                  >
                    &lt; {collectFeeYear - 1}
                  </button>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      padding: "4px 10px",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      borderRadius: 6,
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    Year {collectFeeYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCollectFeeYear((y) => y + 1)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "#475569",
                    }}
                  >
                    {collectFeeYear + 1} &gt;
                  </button>
                </div>
              </div>

              {/* Quick Select Buttons (Does NOT touch or calculate Amount!) */}
              <div className="quick-mark-row" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>Quick Mark:</span>
                {[
                  { count: 1, label: "+ Next 1 Month" },
                  { count: 2, label: "+ Next 2 Months" },
                  { count: 3, label: "+ Next 3 Months" },
                  { count: 6, label: "+ Next 6 Months" },
                ].map((opt) => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => quickSelectCollectMonths(opt.count)}
                    style={{
                      padding: "4px 9px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 11,
                      fontWeight: 650,
                      cursor: "pointer",
                      color: "#334155",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                {collectSelectedMonths.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCollectSelectedMonths([])}
                    style={{
                      padding: "4px 9px",
                      borderRadius: 6,
                      border: "1px solid #fecaca",
                      background: "#fff1f2",
                      fontSize: 11,
                      fontWeight: 650,
                      cursor: "pointer",
                      color: "#b91c1c",
                      marginLeft: "auto",
                    }}
                  >
                    Clear Marked
                  </button>
                )}
              </div>

              {/* 12 Months Grid */}
              {(() => {
                const paidMonths = getStudentPaidMonths(collectFeeStudent.studentProfileId, collectFeeYear);
                const now = new Date();
                const currentYyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                const monthLabels = [
                  { short: "Jan", full: "January" },
                  { short: "Feb", full: "February" },
                  { short: "Mar", full: "March" },
                  { short: "Apr", full: "April" },
                  { short: "May", full: "May" },
                  { short: "Jun", full: "June" },
                  { short: "Jul", full: "July" },
                  { short: "Aug", full: "August" },
                  { short: "Sep", full: "September" },
                  { short: "Oct", full: "October" },
                  { short: "Nov", full: "November" },
                  { short: "Dec", full: "December" },
                ];

                const selectedSorted = [...collectSelectedMonths].sort();
                const selectedLabels = selectedSorted.map((ym) => {
                  const [y, m] = ym.split("-");
                  const idx = parseInt(m || "1", 10) - 1;
                  return `${monthLabels[idx]?.short || m || ""} ${y || ""}`;
                });

                return (
                  <>
                    <div className="calendar-month-grid">
                      {monthLabels.map((item, idx) => {
                        const mNumStr = String(idx + 1).padStart(2, "0");
                        const yyyyMm = `${collectFeeYear}-${mNumStr}`;
                        const isPaid = paidMonths.has(yyyyMm);
                        const isCurrent = yyyyMm === currentYyyyMm;
                        const isSelected = collectSelectedMonths.includes(yyyyMm);

                        let bg = "#ffffff";
                        let border = "1px solid #cbd5e1";
                        let textColor = "#1e293b";
                        let shadow = "none";

                        if (isSelected) {
                          bg = "#eff6ff";
                          border = "2px solid #2563eb";
                          textColor = "#1d4ed8";
                          shadow = "0 2px 6px rgba(37, 99, 235, 0.2)";
                        } else if (isPaid) {
                          bg = "#f0fdf4";
                          border = "1.5px solid #86efac";
                          textColor = "#166534";
                        } else if (isCurrent) {
                          bg = "#fffbeb";
                          border = "1.5px solid #f59e0b";
                          textColor = "#92400e";
                        }

                        return (
                          <div
                            key={yyyyMm}
                            onClick={() => toggleCollectMonth(yyyyMm, isPaid)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              background: bg,
                              border,
                              boxShadow: shadow,
                              cursor: isPaid ? "default" : "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              transition: "all 0.15s ease",
                              userSelect: "none",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12.5, fontWeight: 750, color: textColor }}>
                                {item.short} {collectFeeYear}
                              </span>
                              {isCurrent && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    background: "#fef3c7",
                                    color: "#92400e",
                                    border: "1px solid #fde68a",
                                    padding: "1px 4px",
                                    borderRadius: 3,
                                  }}
                                >
                                  THIS MONTH
                                </span>
                              )}
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                              <span style={{ fontSize: 11, color: isPaid ? "#15803d" : "#64748b" }}>
                                {item.full}
                              </span>

                              {isPaid ? (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    background: "#dcfce7",
                                    color: "#166534",
                                    border: "1px solid #bbf7d0",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                  }}
                                >
                                  PAID
                                </span>
                              ) : isSelected ? (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    background: "#2563eb",
                                    color: "#ffffff",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                  }}
                                >
                                  MARKED
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: "#94a3b8",
                                  }}
                                >
                                  Unpaid
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Selection Summary Alert Banner */}
                    <div
                      style={{
                        padding: "9px 12px",
                        borderRadius: 7,
                        background: collectSelectedMonths.length > 0 ? "#eff6ff" : "#fffbeb",
                        border: collectSelectedMonths.length > 0 ? "1px solid #bfdbfe" : "1px solid #fde68a",
                        fontSize: 12,
                        color: collectSelectedMonths.length > 0 ? "#1e40af" : "#92400e",
                        marginBottom: 14,
                      }}
                    >
                      {collectSelectedMonths.length > 0 ? (
                        <div>
                          <strong>Marked for Payment ({collectSelectedMonths.length}):</strong>{" "}
                          {selectedLabels.join(", ")}
                          <span style={{ display: "block", fontSize: 11, color: "#2563eb", marginTop: 2 }}>
                            Enter the manual fee amount received below.
                          </span>
                        </div>
                      ) : (
                        <div>
                          <strong>No Months Marked:</strong> Please click on one or more unpaid months on the 12-month calendar grid above.
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              <div className="form-group" style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                    Amount to Collect (INR) *
                  </label>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Manual Entry (No auto-calculation)
                  </span>
                </div>
                <input
                  type="number"
                  name="manual_collect_fee_amount"
                  autoComplete="new-password"
                  autoCorrect="off"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="Enter fee amount manually (e.g. 6000)"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                />
                <span style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, display: "block" }}>
                  Enter the exact amount received from the student/member manually. No automatic multiplication.
                </span>
              </div>

              {collectFeeStudent.invoiceId && (
                <div
                  style={{
                    padding: "12px 14px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 10,
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon name="zap" size={16} />
                      <span>1-Click Razorpay Online Pay Link</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#15803d", marginTop: 2 }}>
                      Share link on WhatsApp or open online checkout directly.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <a
                      href={`/pay/${collectFeeStudent.invoiceId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="primary-button"
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        background: "#16a34a",
                        borderColor: "#16a34a",
                        borderRadius: 6,
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span>Pay Online ↗</span>
                    </a>
                    {collectFeeStudent.whatsappUrl && (
                      <a
                        href={collectFeeStudent.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-button"
                        style={{
                          padding: "6px 10px",
                          fontSize: 12,
                          color: "#166534",
                          borderColor: "#86efac",
                          borderRadius: 6,
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>Payment Mode</label>
                  <select
                    value={collectMethod}
                    onChange={(e) => setCollectMethod(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <option value="RAZORPAY_ONLINE">Razorpay (Online Payment / UPI / Cards)</option>
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                    Ref / Transaction ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref 389240"
                    value={collectReference}
                    onChange={(e) => setCollectReference(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Partial fee payment received"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>

              <div
                className="modal-sticky-footer-responsive"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  paddingTop: 14,
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setCollectFeeModalOpen(false)}
                  style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 650 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={collectingFee || collectSelectedMonths.length === 0 || !collectAmount || Number(collectAmount) <= 0}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                  }}
                >
                  {collectingFee
                    ? "Recording Payment…"
                    : `Record Payment of ${formatMoney(Number(collectAmount) * 100 || 0, currency)} (${collectSelectedMonths.length} Mo Plan)`}
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
        title={selectedStudent ? selectedStudent.person.displayName : (isGym ? "Member Profile" : "Student Profile")}
        subtitle={
          isGym
            ? "Complete membership details, workout slot, emergency contact & payment history."
            : "Complete academic enrollment, guardian details, and payment history."
        }
        width={480}
      >
        {selectedStudent && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Header info card */}
            <div
              style={{
                padding: "16px 18px",
                background: "#f8fafc",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>{selectedStudent.person.displayName}</h3>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {selectedStudent.rollNumber ? (isGym ? `Member #${selectedStudent.rollNumber} · ` : `Roll #${selectedStudent.rollNumber} · `) : ""}
                  {selectedStudent.standard} {selectedStudent.batch ? `(${selectedStudent.batch})` : ""}
                </div>
              </div>
              <Badge tone={selectedStudent.status === "ACTIVE" ? "green" : "neutral"}>
                {selectedStudent.status}
              </Badge>
            </div>

            {/* LIVE FEE STATUS CARD (PAID / PENDING DUE) */}
            {(() => {
              const invoices: any[] = studentDetailFull?.person?.invoices || [];
              const latestInv = invoices[0];
              const isCleared =
                latestInv?.status === "PAID" ||
                (latestInv && latestInv.paidTotalMinor > 0 && latestInv.balanceDueMinor <= 0);

              if (isCleared) {
                return (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "#f0fdf4",
                      borderRadius: 12,
                      border: "1px solid #86efac",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: "#dcfce7",
                          color: "#16a34a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          fontWeight: 800,
                        }}
                      ><Icon name="check" size={18} /></div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#166534" }}>
                          Fee Status: PAID (Cleared)
                        </div>
                        <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>
                          Invoice #{latestInv.invoiceNumber} · {formatMoney(latestInv.paidTotalMinor || latestInv.grandTotalMinor, currency)} cleared
                        </div>
                      </div>
                    </div>
                    <Badge tone="green">PAID</Badge>
                  </div>
                );
              }

              if (latestInv && (latestInv.status === "PARTIALLY_PAID" || latestInv.balanceDueMinor > 0)) {
                return (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "#fffbeb",
                      borderRadius: 12,
                      border: "1px solid #fde68a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: "#fef3c7",
                          color: "#d97706",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                        }}
                      ><Icon name="alertCircle" size={18} /></div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#92400e" }}>
                          Fee Status: PENDING DUE
                        </div>
                        <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>
                          Balance Due: {formatMoney(latestInv.balanceDueMinor, currency)} (of {formatMoney(latestInv.grandTotalMinor, currency)})
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="primary-button"
                      style={{
                        padding: "7px 14px",
                        fontSize: 12.5,
                        fontWeight: 700,
                        borderRadius: 8,
                        background: "#d97706",
                        borderColor: "#d97706",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => {
                        setDetailDrawerOpen(false);
                        openCollectFeeModal({
                          studentProfileId: selectedStudent.id,
                          personId: selectedStudent.personId,
                          displayName: selectedStudent.person.displayName,
                          rollNumber: selectedStudent.rollNumber,
                          standard: selectedStudent.standard,
                          batch: selectedStudent.batch,
                          guardianName: selectedStudent.guardianName,
                          guardianPhone: selectedStudent.guardianPhone || selectedStudent.person.primaryPhone,
                          feeFrequency: selectedStudent.feeFrequency,
                          feePlanAmountMinor: selectedStudent.feeAmountMinor,
                          cycleMonth: todayYyyyMm,
                          cycleMonthLabel: formatMonthLabel(todayYyyyMm),
                          status: "PARTIALLY_PAID",
                          paidMinor: latestInv.paidTotalMinor,
                          balanceMinor: latestInv.balanceDueMinor,
                          invoiceId: latestInv.id,
                          invoiceNumber: latestInv.invoiceNumber,
                          lastPaymentDate: latestInv.paidAt || null,
                          whatsappUrl: null,
                        });
                      }}
                    >
                      Collect Due
                    </button>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#fff7ed",
                    borderRadius: 12,
                    border: "1px solid #ffedd5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: "#ffedd5",
                        color: "#c2410c",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                      }}
                    ><Icon name="activity" size={18} /></div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#9a3412" }}>
                        Fee Status: PENDING / DUE
                      </div>
                      <div style={{ fontSize: 12, color: "#c2410c", marginTop: 2 }}>
                        Fee Plan: {formatMoney(selectedStudent.feeAmountMinor, currency)} / {selectedStudent.feeFrequency.toLowerCase()}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    style={{
                      padding: "7px 14px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      borderRadius: 8,
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => {
                      setDetailDrawerOpen(false);
                      openCollectFeeModal({
                        studentProfileId: selectedStudent.id,
                        personId: selectedStudent.personId,
                        displayName: selectedStudent.person.displayName,
                        rollNumber: selectedStudent.rollNumber,
                        standard: selectedStudent.standard,
                        batch: selectedStudent.batch,
                        guardianName: selectedStudent.guardianName,
                        guardianPhone: selectedStudent.guardianPhone || selectedStudent.person.primaryPhone,
                        feeFrequency: selectedStudent.feeFrequency,
                        feePlanAmountMinor: selectedStudent.feeAmountMinor,
                        cycleMonth: todayYyyyMm,
                        cycleMonthLabel: formatMonthLabel(todayYyyyMm),
                        status: "PENDING",
                        paidMinor: 0,
                        balanceMinor: selectedStudent.feeAmountMinor,
                        invoiceId: null,
                        invoiceNumber: null,
                        lastPaymentDate: null,
                        whatsappUrl: null,
                      });
                    }}
                  >
                    Collect Fee
                  </button>
                </div>
              );
            })()}

            {/* Guardian and Contact */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#ffffff" }}>
              <strong
                style={{
                  fontSize: 11.5,
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: 10,
                  letterSpacing: "0.04em",
                }}
              >
                {isGym ? "Contact & Emergency Details" : "Contact & Guardian"}
              </strong>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                <div><strong>{isGym ? "Member Phone:" : "Student Phone:"}</strong> {selectedStudent.person.primaryPhone || "—"}</div>
                <div>
                  <strong>{isGym ? "Emergency Contact:" : "Guardian Name:"}</strong> {selectedStudent.guardianName || "—"}{" "}
                  ({selectedStudent.guardianRelation || (isGym ? "Self" : "Guardian")})
                </div>
                <div><strong>{isGym ? "Emergency Mobile:" : "Guardian Mobile:"}</strong> {selectedStudent.guardianPhone || "—"}</div>
                <div><strong>Email:</strong> {selectedStudent.person.email || "—"}</div>
              </div>
            </div>

            {/* Fee Plan Info */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#ffffff" }}>
              <strong
                style={{
                  fontSize: 11.5,
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: 10,
                  letterSpacing: "0.04em",
                }}
              >
                {isGym ? "Membership Package & Fees" : "Fee Plan Configuration"}
              </strong>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <strong>{isGym ? "Membership Fee:" : "Fee Rate:"}</strong> {formatMoney(selectedStudent.feeAmountMinor, currency)} /{" "}
                  {(() => {
                    const valMonths = (selectedStudent.person.address as any)?.planValidityMonths;
                    if (valMonths) return valMonths === "1" ? "1 month" : `${valMonths} months`;
                    return selectedStudent.feeFrequency.toLowerCase();
                  })()}
                </div>
                <div>
                  <strong>{isGym ? "Joined On:" : "Enrolled On:"}</strong>{" "}
                  {new Date(selectedStudent.admissionDate).toLocaleDateString("en-IN")}
                </div>
              </div>
            </div>

            {/* Term Installment Plan Schedule if present */}
            {(() => {
              const notesStr = selectedStudent.person.notes || "";
              const termMatch = notesStr.match(/\[TERM_PLAN:(.*?)\]/);
              if (!termMatch || !termMatch[1]) return null;

              const terms = termMatch[1].split("|").map((t) => {
                const parts = t.split(":");
                return { name: parts[0] || "Term", amount: parts[1] || "₹0", dueDate: parts[2] || "" };
              });

              return (
                <div style={{ border: "1px solid #fde047", borderRadius: 10, padding: 16, background: "#fefce8" }}>
                  <strong
                    style={{
                      fontSize: 11.5,
                      textTransform: "uppercase",
                      color: "#854d0e",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 10,
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span>Academic Term Installments Schedule</span>
                  </strong>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {terms.map((term, i) => {
                      const guardianPhone = selectedStudent.guardianPhone || selectedStudent.person.primaryPhone;
                      const cleanPhone = guardianPhone ? guardianPhone.replace(/\D/g, "") : "";
                      const studentName = selectedStudent.person.displayName;
                      const waReminderText = encodeURIComponent(
                        `Dear Parent, this is a gentle reminder regarding ${studentName}'s school fee for ${term.name} (${term.amount}), due on ${term.dueDate ? new Date(term.dueDate).toLocaleDateString("en-IN") : "due date"}. - ${orgName}`
                      );

                      return (
                        <div
                          key={i}
                          style={{
                            background: "#ffffff",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid #fde047",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: 12.5,
                          }}
                        >
                          <div>
                            <strong style={{ color: "#854d0e" }}>{term.name}</strong>
                            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                              Due: {term.dueDate ? new Date(term.dueDate).toLocaleDateString("en-IN") : "—"}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: 13, color: "#0f172a" }}>{term.amount}</strong>
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}?text=${waReminderText}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: "#25D366",
                                  color: "#ffffff",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                                title="Send WhatsApp Fee Reminder"
                              >
                                WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="primary-button"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  padding: "9px 14px",
                  borderRadius: 8,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onClick={() => handleOpenEdit(selectedStudent)}
              >
                {isGym ? "Edit Member Profile" : "Edit Student Profile"}
              </button>
              <button
                className="secondary-button"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  padding: "9px 14px",
                  borderRadius: 8,
                  fontWeight: 700,
                  color: selectedStudent.status === "ACTIVE" ? "#b91c1c" : "#047857",
                  background: selectedStudent.status === "ACTIVE" ? "#fef2f2" : "#f0fdf4",
                  borderColor: selectedStudent.status === "ACTIVE" ? "#fecaca" : "#bbf7d0",
                }}
                onClick={() => handleToggleStatus(selectedStudent.id, selectedStudent.status)}
              >
                {selectedStudent.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
              </button>
            </div>

            {/* Invoice & Payment History */}
            {studentDetailFull?.person?.invoices && (
              <div>
                <strong
                  style={{
                    fontSize: 11.5,
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    display: "block",
                    marginBottom: 10,
                    letterSpacing: "0.04em",
                  }}
                >
                  Recent Invoices & Fee Receipts ({studentDetailFull.person.invoices.length})
                </strong>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {studentDetailFull.person.invoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      style={{
                        padding: "12px 14px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12.5,
                        background: "#ffffff",
                      }}
                    >
                      <div>
                        <strong>{inv.invoiceNumber}</strong>
                        <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>
                          {new Date(inv.issueDate).toLocaleDateString("en-IN")} · {inv.notes || "Fee bill"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ fontSize: 13 }}>{formatMoney(inv.grandTotalMinor, currency)}</strong>
                        <div style={{ marginTop: 2 }}>
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
