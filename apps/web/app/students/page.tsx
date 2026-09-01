"use client";

import {
  AppShell,
  Badge,
  Drawer,
  Icon,
  Modal,
  StatCard,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import {
  buildNavItems,
  useWorkspaceContext,
  DEFAULT_SERVICE_CODES,
  getCachedWorkspaceContext,
  saveCachedWorkspaceContext,
  saveActiveServicesToStorage,
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
  lastPaymentDate: string | null;
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

function StudentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = getApiUrl();

  // Active Tab: "directory" | "recurring-fees" | "attendance" | "summary"
  const [activeTab, setActiveTab] = useState<string>("directory");

  // Context & AppShell info (Instant 0ms cached state)
  const { context: cached, isMounted, nav: defaultNav } = useWorkspaceContext();
  const [orgName, setOrgName] = useState("CRMKaro Workspace");
  const [userName, setUserName] = useState("Workspace User");
  const [userRole, setUserRole] = useState("Owner");
  const [currency, setCurrency] = useState("INR");
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);
  const [activeServiceCodes, setActiveServiceCodes] = useState<string[]>(DEFAULT_SERVICE_CODES);

  useEffect(() => {
    if (isMounted) {
      setOrgName(cached.orgName);
      setUserName(cached.userName);
      setUserRole(cached.userRole);
      setCurrency(cached.currency);
      setActiveServiceCodes(cached.activeServices);
    }
  }, [isMounted, cached]);

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
  const [formStandard, setFormStandard] = useState("10th Standard");
  const [formBatch, setFormBatch] = useState("Morning Batch");
  const [formGuardianName, setFormGuardianName] = useState("");
  const [formGuardianPhone, setFormGuardianPhone] = useState("");
  const [formGuardianRelation, setFormGuardianRelation] = useState("Father");
  const [formFeeFrequency, setFormFeeFrequency] = useState<"MONTHLY" | "QUARTERLY" | "ANNUAL">("MONTHLY");
  const [formFeeAmount, setFormFeeAmount] = useState("500");
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
          const srvs = activeOrgEntry.activeServices || activeOrgEntry.organisation.activeServices;
          if (srvs && Array.isArray(srvs)) {
            setActiveServiceCodes(srvs);
            saveActiveServicesToStorage(srvs);
          }
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
      let finalNotes = formNotes.trim();
      let calculatedFeeAmount = Math.round(Number(formFeeAmount) * 100) || 0;
      let finalFeeFrequency = formFeeFrequency;

      if (feePlanType === "TERM_INSTALLMENTS") {
        finalFeeFrequency = "QUARTERLY";
        const t1 = Math.round(Number(term1Amount) * 100) || 0;
        calculatedFeeAmount = t1;
        const termMetadata = `[TERM_PLAN:Term 1:₹${term1Amount}:${term1DueDate}|Term 2:₹${term2Amount}:${term2DueDate}|Term 3:₹${term3Amount}:${term3DueDate}]`;
        finalNotes = finalNotes ? `${finalNotes}\n${termMetadata}` : termMetadata;
      }

      const payload = {
        displayName: formName.trim(),
        primaryPhone: formPhone.trim() || undefined,
        alternatePhone: formAltPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        address:
          formStreet || formCity || formState
            ? { street: formStreet, city: formCity, state: formState }
            : undefined,
        rollNumber: formRollNumber.trim() || undefined,
        standard: formStandard.trim(),
        batch: formBatch.trim() || undefined,
        guardianName: formGuardianName.trim() || undefined,
        guardianPhone: formGuardianPhone.trim() || undefined,
        guardianRelation: formGuardianRelation.trim() || undefined,
        feeFrequency: finalFeeFrequency,
        feeAmountMinor: calculatedFeeAmount,
        admissionDate: formAdmissionDate,
        billingStartDate: formAdmissionDate,
        notes: finalNotes || undefined,
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
      const address =
        formStreet.trim() || formCity.trim() || formState.trim()
          ? {
              street: formStreet.trim(),
              city: formCity.trim(),
              state: formState.trim(),
            }
          : undefined;

      const payload = {
        displayName: formName.trim(),
        primaryPhone: formPhone.trim() || null,
        alternatePhone: formAltPhone.trim() || null,
        email: formEmail.trim() || null,
        address,
        rollNumber: formRollNumber.trim() || null,
        standard: formStandard.trim(),
        batch: formBatch.trim() || null,
        guardianName: formGuardianName.trim() || null,
        guardianPhone: formGuardianPhone.trim() || null,
        guardianRelation: formGuardianRelation.trim() || null,
        feeFrequency: formFeeFrequency,
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

  // 1-Click Fee Collection Modal Open
  function openCollectFeeModal(item: RecurringFeeItem) {
    setCollectFeeStudent(item);
    setCollectAmount(
      (item.balanceMinor > 0 ? item.balanceMinor / 100 : item.feePlanAmountMinor / 100).toString(),
    );
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
        amountPaidMinor: data.amountPaidMinor,
        balanceDueMinor: data.balanceDueMinor,
        totalFeeMinor: data.totalFeeMinor,
        emailSent: data.emailSent,
        emailTarget: data.emailTarget,
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
      edits[it.studentProfileId] = {
        status: "PRESENT",
        remarks: attendanceEdits[it.studentProfileId]?.remarks || "",
      };
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
  const distinctBatches = Array.from(
    new Set(students.map((s) => s.batch).filter((b): b is string => Boolean(b))),
  );

  const tabItems = [
    { id: "directory", label: "Student Directory", icon: "student" as const, count: students.length },
    {
      id: "recurring-fees",
      label: "Recurring Fees Cycle",
      icon: "finance" as const,
      count: recurringFeesData?.pendingCount ?? 0,
      highlight: (recurringFeesData?.pendingCount ?? 0) > 0,
    },
    { id: "attendance", label: "Daily Attendance Grid", icon: "calendar" as const },
    { id: "summary", label: "Monthly Summary Report", icon: "reports" as const },
  ];

  const navItems: NavItem[] = isMounted ? buildNavItems(activeServiceCodes) : defaultNav;

  return (
    <AppShell
      product="CRMKaro"
      organisation={isMounted ? orgName : "CRMKaro Workspace"}
      organisations={organisations}
      currentPath="/students"
      nav={navItems}
      userName={isMounted ? userName : "Workspace User"}
      userRole={isMounted ? userRole : "Owner"}
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
              fontWeight: 700,
              color: "var(--brand)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            <Icon name="student" size={15} /> Student Lifecycle & Academy Portal
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", margin: 0, letterSpacing: "-0.02em" }}>
            Students & Academy Management
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "4px 0 0", maxWidth: 650 }}>
            Track one-time student admissions, automated recurring monthly fees rolling ledger, and 1-click attendance.
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
          <span>New Student Admission</span>
        </button>
      </div>

      {/* Quick Summary Metric Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
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
                No students enrolled yet
              </h3>
              <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 440, margin: "0 auto 20px" }}>
                Admit students with class/batch, guardian phone for WhatsApp receipts, and recurring fee plan.
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
                <span>Admit First Student</span>
              </button>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th>Standard & Batch</th>
                    <th>Guardian / Parent</th>
                    <th>Fee Plan</th>
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
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{std.guardianName || "—"}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                          {std.guardianRelation ? `(${std.guardianRelation}) ` : ""}
                          {std.guardianPhone || "—"}
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: "var(--ink)", fontSize: 13 }}>
                          {formatMoney(std.feeAmountMinor, currency)}
                        </strong>
                        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "lowercase" }}>
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
                            ✏️ Edit
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
                  {recurringFeesData.studentsCount} Active students enrolled
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
                  {recurringFeesData.paidCount} students cleared
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
                  {recurringFeesData.pendingCount} students pending
                </small>
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
                No active students enrolled for {recurringFeesData?.cycleMonthLabel || "this month"}.
              </p>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th>Standard & Batch</th>
                    <th>Guardian Contact</th>
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
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.guardianName || "—"}</div>
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
                              ✓ Received
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
                ✓ Mark All Present
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
                              onClick={() => handleToggleAttendance(item.studentProfileId, "PRESENT")}
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
                              onClick={() => handleToggleAttendance(item.studentProfileId, "ABSENT")}
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
                              onClick={() => handleToggleAttendance(item.studentProfileId, "LEAVE")}
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
        title="🎓 New Student Admission & Enrollment"
        subtitle="Create permanent student record, course batch, guardian contact, and recurring fee plan."
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
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="people" size={14} /> Student Profile & Contact
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  Student Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aryan Sharma"
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
                  Student Mobile Number
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  Student ID / Roll Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. STD-101 (leave blank for auto)"
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
                  Email ID (Optional)
                </label>
                <input
                  type="email"
                  placeholder="student@example.com"
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
                color: "#1e40af",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="student" size={14} /> Class / Course & Batch Allocation
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
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
                  Batch Timing / Shift
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning 8:00 AM, Evening Shift"
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
            </div>
          </div>

          {/* Section 3: Guardian Details (For WhatsApp & PDF Receipts) */}
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
              <Icon name="phone" size={14} /> Guardian Contact (For Automated WhatsApp & PDF Receipts)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#166534" }}>Guardian Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Sharma"
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
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#166534" }}>Guardian Mobile *</label>
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
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#166534" }}>Relation</label>
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
                    fontWeight: 600,
                  }}
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Self">Self</option>
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
                <Icon name="rupee" size={14} /> Fee Plan &amp; Billing Structure
              </span>

              {/* Plan Choice Pills */}
              <div style={{ display: "inline-flex", background: "#ffffff", padding: "2px", borderRadius: 8, border: "1px solid #fde047" }}>
                <button
                  type="button"
                  onClick={() => setFeePlanType("MONTHLY")}
                  style={{
                    padding: "3px 10px",
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
                    padding: "3px 10px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: feePlanType === "TERM_INSTALLMENTS" ? "#854d0e" : "transparent",
                    color: feePlanType === "TERM_INSTALLMENTS" ? "#ffffff" : "#854d0e",
                  }}
                >
                  📋 3-Term Installments (Term 1, 2, 3)
                </button>
              </div>
            </div>

            {feePlanType === "MONTHLY" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 650, color: "#854d0e" }}>Billing Frequency</label>
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
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 650, color: "#854d0e" }}>Monthly Fee (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
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
                    }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 650, color: "#854d0e" }}>Admission Date</label>
                  <input
                    type="date"
                    value={formAdmissionDate}
                    onChange={(e) => setFormAdmissionDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #fde047",
                      fontSize: 13,
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#713f12" }}>
                  Annual academic fee is divided into 3 flexible term installments. Each installment has its own due date.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {/* Term 1 */}
                  <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: 8, border: "1px solid #fde047" }}>
                    <strong style={{ fontSize: 12, color: "#854d0e", display: "block", marginBottom: 6 }}>
                      📚 Term 1 (Admission)
                    </strong>
                    <label style={{ fontSize: 11, color: "#713f12", display: "block" }}>Amount (₹)</label>
                    <input
                      type="number"
                      value={term1Amount}
                      onChange={(e) => setTerm1Amount(e.target.value)}
                      required
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12.5, marginBottom: 6 }}
                    />
                    <label style={{ fontSize: 11, color: "#713f12", display: "block" }}>Due Date</label>
                    <input
                      type="date"
                      value={term1DueDate}
                      onChange={(e) => setTerm1DueDate(e.target.value)}
                      required
                      style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 11.5 }}
                    />
                  </div>

                  {/* Term 2 */}
                  <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: 8, border: "1px solid #fde047" }}>
                    <strong style={{ fontSize: 12, color: "#854d0e", display: "block", marginBottom: 6 }}>
                      📖 Term 2 (Mid-Term)
                    </strong>
                    <label style={{ fontSize: 11, color: "#713f12", display: "block" }}>Amount (₹)</label>
                    <input
                      type="number"
                      value={term2Amount}
                      onChange={(e) => setTerm2Amount(e.target.value)}
                      required
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12.5, marginBottom: 6 }}
                    />
                    <label style={{ fontSize: 11, color: "#713f12", display: "block" }}>Due Date</label>
                    <input
                      type="date"
                      value={term2DueDate}
                      onChange={(e) => setTerm2DueDate(e.target.value)}
                      required
                      style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 11.5 }}
                    />
                  </div>

                  {/* Term 3 */}
                  <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: 8, border: "1px solid #fde047" }}>
                    <strong style={{ fontSize: 12, color: "#854d0e", display: "block", marginBottom: 6 }}>
                      🎓 Term 3 (Final Term)
                    </strong>
                    <label style={{ fontSize: 11, color: "#713f12", display: "block" }}>Amount (₹)</label>
                    <input
                      type="number"
                      value={term3Amount}
                      onChange={(e) => setTerm3Amount(e.target.value)}
                      required
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12.5, marginBottom: 6 }}
                    />
                    <label style={{ fontSize: 11, color: "#713f12", display: "block" }}>Due Date</label>
                    <input
                      type="date"
                      value={term3DueDate}
                      onChange={(e) => setTerm3DueDate(e.target.value)}
                      required
                      style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 11.5 }}
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

          {/* Section 5: Address */}
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
              <Icon name="building" size={14} /> Address (Optional)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. 42 MG Road"
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
                  placeholder="e.g. Mumbai"
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
                  placeholder="e.g. Maharashtra"
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
          </div>

          {/* Action Buttons in Modal Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              paddingTop: 18,
              borderTop: "1px solid #e2e8f0",
              marginTop: 10,
            }}
          >
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAdmissionModalOpen(false)}
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
              disabled={admissionBusy}
              style={{
                padding: "9px 22px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                cursor: "pointer",
              }}
            >
              {admissionBusy ? "Admitting Student…" : "Save Admission & Permanent Profile"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: EDIT EXISTING STUDENT PROFILE                          */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`✏️ Edit Student: ${editingStudent?.person.displayName || "Profile"}`}
        subtitle="Update academic allocation, contact numbers, guardian information, and recurring fee plan."
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
              <Icon name="people" size={14} /> Student Profile & Contact
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  Student Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aryan Sharma"
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
                  Student Mobile Number
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  Student ID / Roll Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. STD-101"
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
                  placeholder="student@example.com"
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
              <Icon name="student" size={14} /> Class & Batch Allocation
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                  Standard / Class *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10th Standard"
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
                  Section / Batch
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning Batch"
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
                  <option value="ACTIVE">Active Student</option>
                  <option value="INACTIVE">Inactive / Alumni</option>
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
              <Icon name="people" size={14} /> Parent & Guardian (WhatsApp Receipts)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#166534" }}>
                  Guardian Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma"
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
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Self">Self</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#166534" }}>
                  Guardian WhatsApp Mobile
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
              <Icon name="rupee" size={14} /> Recurring Fee Plan
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#854d0e" }}>Billing Frequency</label>
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
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12.5, fontWeight: 650, color: "#854d0e" }}>Monthly Fee Amount (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
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
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 5: Address & Notes */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. 42 MG Road"
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
                  placeholder="e.g. Mumbai"
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
                  placeholder="e.g. Maharashtra"
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

          {/* Action Buttons in Modal Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              paddingTop: 18,
              borderTop: "1px solid #e2e8f0",
              marginTop: 10,
            }}
          >
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
              {editBusy ? "Saving Changes…" : "Save Student Changes"}
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

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px dashed #cbd5e1", fontSize: 12.5 }}>
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

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                  Amount to Collect (₹) *
                </label>
                <input
                  type="number"
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
                  💡 If student is paying partially, enter the paid amount (e.g. ₹4,000). Remaining balance will stay pending.
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
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
                  disabled={collectingFee}
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
                    : `Record Payment of ${formatMoney(Number(collectAmount) * 100 || 0, currency)}`}
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
        subtitle="Complete academic enrollment, guardian details, and payment history."
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
                  {selectedStudent.rollNumber ? `Roll #${selectedStudent.rollNumber} · ` : ""}
                  {selectedStudent.standard} {selectedStudent.batch ? `(${selectedStudent.batch})` : ""}
                </div>
              </div>
              <Badge tone={selectedStudent.status === "ACTIVE" ? "green" : "neutral"}>
                {selectedStudent.status}
              </Badge>
            </div>

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
                Contact & Guardian
              </strong>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                <div>📱 <strong>Student Phone:</strong> {selectedStudent.person.primaryPhone || "—"}</div>
                <div>
                  👤 <strong>Guardian Name:</strong> {selectedStudent.guardianName || "—"}{" "}
                  ({selectedStudent.guardianRelation || "Guardian"})
                </div>
                <div>📞 <strong>Guardian Mobile:</strong> {selectedStudent.guardianPhone || "—"}</div>
                <div>✉️ <strong>Email:</strong> {selectedStudent.person.email || "—"}</div>
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
                Fee Plan Configuration
              </strong>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  💰 <strong>Fee Rate:</strong> {formatMoney(selectedStudent.feeAmountMinor, currency)} /{" "}
                  {selectedStudent.feeFrequency.toLowerCase()}
                </div>
                <div>
                  📅 <strong>Enrolled On:</strong>{" "}
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
                    <span>📋 Academic Term Installments Schedule</span>
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
                                📲 WhatsApp
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
                ✏️ Edit Student Profile
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
