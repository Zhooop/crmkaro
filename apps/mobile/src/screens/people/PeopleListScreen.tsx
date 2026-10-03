import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
  ScrollView,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { SearchInput } from "../../components/SearchInput";
import { Badge } from "../../components/Badge";
import { BottomSheet } from "../../components/BottomSheet";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Icon } from "../../components/Icon";
import { apiFetch } from "../../api/client";
import { colors, radius, spacing } from "../../theme/colors";

export type Person = {
  id: string;
  displayName: string;
  primaryPhone: string | null;
  alternatePhone: string | null;
  email: string | null;
  notes: string | null;
  status?: "ACTIVE" | "ARCHIVED";
  createdAt?: string;
  types: Array<{ type: string }>;
  tags: Array<{ tagId: string; tag?: { name: string } }>;
  address?: Record<string, any>;
  studentProfile?: {
    id: string;
    rollNumber: string | null;
    standard: string | null;
    batch: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
    guardianRelation?: string | null;
    feeAmountMinor: number;
    feeFrequency: string;
    admissionDate: string;
    billingStartDate?: string;
    status: string;
  } | null;
  payments?: Array<{
    id: string;
    amountMinor: number;
    receivedAt: string;
    method: string;
    status: string;
    invoiceId: string | null;
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    grandTotalMinor: number;
    paidTotalMinor: number;
    balanceDueMinor: number;
    dueDate: string;
    status: string;
    notes?: string | null;
  }>;
};

export type PersonFeeDetails = {
  hasFeePlan: boolean;
  planMonths: number;
  planLabel: string;
  feeAmountMinor: number;
  latestPayment: {
    id: string;
    amountMinor: number;
    receivedAt: string;
    method: string;
    status: string;
    invoiceId: string | null;
  } | null;
  latestInvoice: {
    id: string;
    invoiceNumber: string;
    grandTotalMinor: number;
    paidTotalMinor: number;
    balanceDueMinor: number;
    dueDate: string;
    status: string;
    notes?: string | null;
  } | null;
  feeStatus: "PAID" | "EXPIRING_SOON" | "OVERDUE" | "PARTIALLY_PAID" | "PENDING" | "NO_PLAN";
  statusBadgeLabel: string;
  statusBadgeColor: string;
  statusBadgeBg: string;
  statusBadgeBorder: string;
  validUntilDate: Date | null;
  validUntilStr: string | null;
  daysRemaining: number | null;
  paidAmountMinor: number;
  paidDateStr: string | null;
  paidMethod: string | null;
  memberId: string | null;
  standard: string | null;
  batch: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianRelation: string | null;
  admissionDateStr: string | null;
};

export function getPersonFeeDetails(person: Person): PersonFeeDetails {
  const profile = person.studentProfile;
  const payments = person.payments || [];
  const invoices = person.invoices || [];

  let addr: Record<string, any> = {};
  if (person.address) {
    if (typeof person.address === "object") {
      addr = person.address as Record<string, any>;
    } else if (typeof person.address === "string") {
      try {
        addr = JSON.parse(person.address);
      } catch {}
    }
  }

  let planMonths = 1;
  const rawMonths = addr.planValidityMonths || addr.validityMonths || addr.planMonths;
  if (rawMonths) {
    const parsed = parseInt(String(rawMonths), 10);
    if (!isNaN(parsed) && parsed > 0) planMonths = parsed;
  } else if (profile?.feeFrequency === "ANNUAL") {
    planMonths = 12;
  } else if (profile?.feeFrequency === "QUARTERLY") {
    planMonths = 3;
  } else {
    const combinedNotes = `${person.notes || ""} ${invoices[0]?.notes || ""}`;
    const tagMatch = combinedNotes.match(/\[PLAN_VALIDITY:(\d+)_MONTHS\]/i);
    if (tagMatch && tagMatch[1]) {
      const p = parseInt(tagMatch[1], 10);
      if (!isNaN(p) && p > 0) planMonths = p;
    } else {
      const cycleMatch = combinedNotes.match(/Fee Cycle:\s*(\d+)\s*Months/i);
      if (cycleMatch && cycleMatch[1]) {
        const p = parseInt(cycleMatch[1], 10);
        if (!isNaN(p) && p > 0) planMonths = p;
      } else {
        const m = combinedNotes.match(/(\d+)\s*(?:month|mahina|mahine)/i);
        if (m && m[1]) {
          const p = parseInt(m[1], 10);
          if (!isNaN(p) && p > 0 && p <= 12) planMonths = p;
        }
      }
    }
  }



  const feeAmountMinor = profile?.feeAmountMinor || invoices[0]?.grandTotalMinor || 0;
  const latestPayment = payments[0] || null;
  const latestInvoice = invoices[0] || null;
  const memberId = profile?.rollNumber || addr.admissionNumber || addr.rollNumber || null;
  const standard = profile?.standard || addr.standard || null;
  const batch = profile?.batch || addr.batch || null;
  const guardianName = profile?.guardianName || addr.guardianName || null;
  const guardianPhone = profile?.guardianPhone || addr.guardianPhone || null;
  const guardianRelation = profile?.guardianRelation || addr.guardianRelation || null;
  const rawAdmissionDate = profile?.admissionDate || addr.admissionDate || null;
  const admissionDateStr = rawAdmissionDate
    ? new Date(rawAdmissionDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  const planLabel =
    planMonths === 1
      ? "1 Month Plan"
      : planMonths === 3
      ? "3 Months (Quarterly)"
      : planMonths === 6
      ? "6 Months (Half-Yearly)"
      : planMonths === 12
      ? "12 Months (1 Year)"
      : `${planMonths} Months Plan`;

  const now = new Date();
  const nowMs = now.getTime();

  let feeStatus: PersonFeeDetails["feeStatus"] = "NO_PLAN";
  let statusBadgeLabel = "No Active Plan";
  let statusBadgeColor = "#64748b";
  let statusBadgeBg = "#f1f5f9";
  let statusBadgeBorder = "#cbd5e1";
  let validUntilDate: Date | null = null;
  let validUntilStr: string | null = null;
  let daysRemaining: number | null = null;
  let paidAmountMinor = 0;
  let paidDateStr: string | null = null;
  let paidMethod: string | null = null;

  if (latestPayment) {
    paidAmountMinor = latestPayment.amountMinor;
    paidDateStr = new Date(latestPayment.receivedAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    paidMethod = latestPayment.method || "CASH";
  } else if (latestInvoice && latestInvoice.paidTotalMinor > 0) {
    paidAmountMinor = latestInvoice.paidTotalMinor;
    paidDateStr = new Date(latestInvoice.dueDate || person.createdAt || Date.now()).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    paidMethod = "RECORDED";
  }

  const hasPlan = feeAmountMinor > 0 || Boolean(profile) || payments.length > 0 || invoices.length > 0 || Boolean(addr.planValidityMonths);

  if (hasPlan) {
    if (latestInvoice && latestInvoice.paidTotalMinor > 0 && latestInvoice.balanceDueMinor > 0) {
      feeStatus = "PARTIALLY_PAID";
      statusBadgeLabel = `Partially Paid (₹${(latestInvoice.balanceDueMinor / 100).toLocaleString("en-IN")} Due)`;
      statusBadgeColor = "#b45309";
      statusBadgeBg = "#fef3c7";
      statusBadgeBorder = "#fde68a";
    } else if (latestPayment || (latestInvoice && latestInvoice.paidTotalMinor > 0)) {
      if (Array.isArray(addr.paidMonths) && addr.paidMonths.length > 0) {
        const sorted = [...addr.paidMonths].filter((m: string) => typeof m === "string" && /^\d{4}-\d{2}$/.test(m)).sort();
        if (sorted.length > 0) {
          const lastMonth = sorted[sorted.length - 1];
          const [yStr, mStr] = lastMonth.split("-");
          const y = parseInt(yStr, 10);
          const m = parseInt(mStr, 10);
          validUntilDate = new Date(y, m, 0); // Last calendar day of the last paid month
        }
      }

      if (!validUntilDate) {
        const baseDate = latestPayment
          ? new Date(latestPayment.receivedAt)
          : new Date(rawAdmissionDate || person.createdAt || Date.now());

        validUntilDate = new Date(baseDate);
        validUntilDate.setMonth(validUntilDate.getMonth() + planMonths);
      }

      validUntilStr = validUntilDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const diffMs = validUntilDate.getTime() - nowMs;
      daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

      if (daysRemaining > 10) {
        feeStatus = "PAID";
        statusBadgeLabel = `Paid (till ${validUntilStr})`;
        statusBadgeColor = "#047857";
        statusBadgeBg = "#d1fae5";
        statusBadgeBorder = "#a7f3d0";
      } else if (daysRemaining >= 0) {
        feeStatus = "EXPIRING_SOON";
        statusBadgeLabel = daysRemaining === 0 ? `Expires Today (${validUntilStr})` : `Upcoming (Expires in ${daysRemaining}d · ${validUntilStr})`;
        statusBadgeColor = "#b45309";
        statusBadgeBg = "#fffbeb";
        statusBadgeBorder = "#fde68a";
      } else {
        feeStatus = "OVERDUE";
        statusBadgeLabel = `Overdue (${Math.abs(daysRemaining)}d ago · ${validUntilStr})`;
        statusBadgeColor = "#dc2626";
        statusBadgeBg = "#fef2f2";
        statusBadgeBorder = "#fecaca";
      }
    } else {
      feeStatus = "PENDING";
      const dueAmount = latestInvoice ? latestInvoice.balanceDueMinor : feeAmountMinor;
      statusBadgeLabel = dueAmount > 0 ? `Unpaid (₹${(dueAmount / 100).toLocaleString("en-IN")} Due)` : "Fee Unpaid";
      statusBadgeColor = "#dc2626";
      statusBadgeBg = "#fef2f2";
      statusBadgeBorder = "#fecaca";
    }
  }

  return {
    hasFeePlan: hasPlan,
    planMonths,
    planLabel,
    feeAmountMinor,
    latestPayment,
    latestInvoice,
    feeStatus,
    statusBadgeLabel,
    statusBadgeColor,
    statusBadgeBg,
    statusBadgeBorder,
    validUntilDate,
    validUntilStr,
    daysRemaining,
    paidAmountMinor,
    paidDateStr,
    paidMethod,
    memberId,
    standard,
    batch,
    guardianName,
    guardianPhone,
    guardianRelation,
    admissionDateStr,
  };
}

export function getPersonPaidMonths(person: Person, currentYear?: number): Set<string> {
  const paidSet = new Set<string>();
  let addr: Record<string, any> = {};
  if (person.address) {
    if (typeof person.address === "object") addr = person.address as Record<string, any>;
    else if (typeof person.address === "string") {
      try { addr = JSON.parse(person.address); } catch {}
    }
  }

  if (Array.isArray(addr.paidMonths)) {
    addr.paidMonths.forEach((m: string) => {
      if (typeof m === "string" && /^\d{4}-\d{2}$/.test(m)) paidSet.add(m);
    });
  }


  const invoices = person.invoices || [];
  invoices.forEach((inv) => {
    if (inv.status === "PAID" || inv.balanceDueMinor <= 0) {
      if (inv.notes) {
        const matches = inv.notes.matchAll(/(\d{4}-\d{2})/g);
        for (const m of matches) {
          paidSet.add(m[1]);
        }
      }
    }
  });

  if (paidSet.size === 0) {
    const details = getPersonFeeDetails(person);
    if (details.validUntilDate && (details.feeStatus === "PAID" || details.feeStatus === "EXPIRING_SOON")) {
      const adminDate = person.studentProfile?.admissionDate
        ? new Date(person.studentProfile.admissionDate)
        : new Date(2026, 0, 1);
      const curr = new Date(adminDate.getFullYear(), adminDate.getMonth(), 1);
      const limit = new Date(details.validUntilDate.getFullYear(), details.validUntilDate.getMonth(), 1);
      while (curr <= limit) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, "0");
        paidSet.add(`${y}-${m}`);
        curr.setMonth(curr.getMonth() + 1);
      }
    }
  }

  return paidSet;
}

export function PeopleListScreen() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CUSTOMER" | "STUDENT" | "STAFF">("ALL");
  const [feeFilter, setFeeFilter] = useState<"ALL" | "PENDING" | "PAID" | "UPCOMING">("ALL");
  const [updatingPlanBusy, setUpdatingPlanBusy] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [activeTab, setActiveTab] = useState<"personal" | "address" | "more">("personal");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formPlanMonths, setFormPlanMonths] = useState(3);
  const [formAdmissionNo, setFormAdmissionNo] = useState("");
  const [formStandard, setFormStandard] = useState("");
  const [formBatch, setFormBatch] = useState("");
  const [formGuardianName, setFormGuardianName] = useState("");
  const [formGuardianPhone, setFormGuardianPhone] = useState("");
  const [formGuardianRelation, setFormGuardianRelation] = useState("Self");
  const [formAdmissionDate, setFormAdmissionDate] = useState("");
  const [formBusy, setFormBusy] = useState(false);

  // Detail Sheet
  const [detailPerson, setDetailPerson] = useState<Person | null>(null);

  // Renewal Fee Modal State (12-Month Calendar Grid)
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [renewalPerson, setRenewalPerson] = useState<Person | null>(null);
  const [renewalYear, setRenewalYear] = useState<number>(new Date().getFullYear());
  const [renewalSelectedMonths, setRenewalSelectedMonths] = useState<string[]>([]);
  const [renewalPlanMonths, setRenewalPlanMonths] = useState(1);
  const [renewalAmount, setRenewalAmount] = useState(""); // 100% manual input!
  const [renewalMethod, setRenewalMethod] = useState<"UPI" | "CASH" | "BANK_TRANSFER">("UPI");
  const [renewalReference, setRenewalReference] = useState("");
  const [renewalNotes, setRenewalNotes] = useState("");
  const [renewalBusy, setRenewalBusy] = useState(false);

  const fetchPeople = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: Person[] }>("/people?limit=100");
      if (res.data?.items) {
        setPeople(res.data.items);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const openCreateModal = () => {
    setEditingPerson(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormNotes("");
    setFormPlanMonths(3);
    setFormAdmissionNo(`GYM-${1000 + people.length + 1}`);
    setFormStandard("Strength Training");
    setFormBatch("Morning 6-8 AM");
    setFormGuardianName("");
    setFormGuardianPhone("");
    setFormGuardianRelation("Self");
    setFormAdmissionDate(new Date().toISOString().slice(0, 10));
    setActiveTab("personal");
    setIsModalOpen(true);
  };

  const openEditModal = (person: Person) => {
    setEditingPerson(person);
    setFormName(person.displayName || "");
    setFormPhone(person.primaryPhone || "");
    setFormEmail(person.email || "");
    const addr = (person.address && typeof person.address === "object" ? person.address : {}) as Record<string, any>;
    setFormAddress(addr.addressLine1 || addr.street || "");
    setFormNotes(person.notes || "");

    const feeD = getPersonFeeDetails(person);
    setFormPlanMonths(feeD.planMonths || 1);
    setFormAdmissionNo(feeD.memberId || "");
    setFormStandard(feeD.standard || "");
    setFormBatch(feeD.batch || "");
    setFormGuardianName(feeD.guardianName || "");
    setFormGuardianPhone(feeD.guardianPhone || "");
    setFormGuardianRelation(feeD.guardianRelation || "Self");
    setFormAdmissionDate(
      addr.admissionDate || (person.studentProfile?.admissionDate ? new Date(person.studentProfile.admissionDate).toISOString().slice(0, 10) : "")
    );

    setActiveTab("personal");
    setDetailPerson(null);
    setIsModalOpen(true);
  };

  const handleQuickUpdatePlanValidity = async (personId: string, months: number) => {
    try {
      setUpdatingPlanBusy(personId);
      const target = people.find((p) => p.id === personId);
      const currentAddr = target?.address && typeof target.address === "object" ? target.address : {};
      const updatedAddress = {
        ...currentAddr,
        planValidityMonths: String(months),
      };
      const updatedNotes = `${target?.notes || ""} [PLAN_VALIDITY:${months}_MONTHS]`.trim();

      const res = await apiFetch(`/people/${personId}`, {
        method: "PATCH",
        body: JSON.stringify({
          address: updatedAddress,
          notes: updatedNotes,
        }),
      });

      if (res.error) throw new Error(res.error);

      setPeople((prev) =>
        prev.map((p) => {
          if (p.id !== personId) return p;
          return {
            ...p,
            notes: updatedNotes,
            address: updatedAddress,
          };
        })
      );

      if (detailPerson?.id === personId) {
        setDetailPerson((prev) =>
          prev
            ? {
                ...prev,
                notes: updatedNotes,
                address: updatedAddress,
              }
            : null
        );
      }

      Alert.alert("Plan Updated", `Membership plan validity updated to ${months} month(s)!`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update validity plan");
    } finally {
      setUpdatingPlanBusy(null);
    }
  };

  const openRenewalModal = (person: Person) => {
    setRenewalPerson(person);
    setRenewalYear(new Date().getFullYear());
    setRenewalSelectedMonths([]);
    setRenewalAmount(""); // 100% manual input! Never auto-calculated!
    setRenewalMethod("UPI");
    setRenewalReference("");
    setRenewalNotes("");
    setRenewalModalOpen(true);
  };

  const toggleRenewalMonth = (yyyyMm: string, isPaid: boolean) => {
    if (isPaid) return;
    setRenewalSelectedMonths((prev) => {
      if (prev.includes(yyyyMm)) {
        return prev.filter((m) => m !== yyyyMm);
      } else {
        return [...prev, yyyyMm].sort();
      }
    });
    // NOTE: NEVER auto-calculate or overwrite renewalAmount! Amount is 100% manual entry.
  };

  const quickSelectRenewalMonths = (count: number) => {
    if (!renewalPerson) return;
    const paidSet = getPersonPaidMonths(renewalPerson, renewalYear);
    const months: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const yyyyMm = `${renewalYear}-${String(m).padStart(2, "0")}`;
      if (!paidSet.has(yyyyMm)) {
        months.push(yyyyMm);
        if (months.length === count) break;
      }
    }
    setRenewalSelectedMonths(months.sort());
    // NOTE: NEVER auto-calculate or overwrite renewalAmount! Amount is 100% manual entry.
  };

  const handleSaveRenewal = async () => {
    if (!renewalPerson) return;
    if (renewalSelectedMonths.length === 0) {
      Alert.alert("Required", "Please select at least one month on the calendar grid to mark as paid.");
      return;
    }
    const amt = Number(renewalAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid renewal fee amount manually.");
      return;
    }

    setRenewalBusy(true);
    try {
      const planMonths = Math.max(1, renewalSelectedMonths.length);
      const startMonth = renewalSelectedMonths[0];

      if (renewalPerson.studentProfile?.id) {
        await apiFetch("/students/collect-fee", {
          method: "POST",
          body: JSON.stringify({
            studentProfileId: renewalPerson.studentProfile.id,
            month: startMonth,
            selectedMonths: renewalSelectedMonths,
            amountMinor: Math.round(amt * 100),
            paymentMethod: renewalMethod,
            planMonths,
            reference: renewalReference.trim() || undefined,
            notes: renewalNotes.trim() || undefined,
          }),
        });
      }

      const currentAddr =
        renewalPerson.address && typeof renewalPerson.address === "object"
          ? (renewalPerson.address as Record<string, any>)
          : {};
      const existingPaid: string[] = Array.isArray(currentAddr.paidMonths) ? currentAddr.paidMonths : [];
      const mergedPaid = Array.from(new Set([...existingPaid, ...renewalSelectedMonths])).sort();
      const updatedAddress = {
        ...currentAddr,
        paidMonths: mergedPaid,
        planValidityMonths: String(planMonths),
      };

      await apiFetch(`/people/${renewalPerson.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          address: updatedAddress,
        }),
      });

      Alert.alert(
        "Fee Collected & Renewed!",
        `Successfully collected INR ${amt.toLocaleString("en-IN")} for ${renewalPerson.displayName} (${renewalSelectedMonths.length} month(s) marked).`
      );

      setRenewalModalOpen(false);
      setDetailPerson(null);
      fetchPeople();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to process renewal fee.");
    } finally {
      setRenewalBusy(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert("Required", "Member name is required.");
      return;
    }

    setFormBusy(true);
    try {
      const addressPayload: Record<string, string> = {};
      if (formAddress.trim()) addressPayload.addressLine1 = formAddress.trim();
      if (formPlanMonths) addressPayload.planValidityMonths = String(formPlanMonths);
      if (formAdmissionNo.trim()) addressPayload.admissionNumber = formAdmissionNo.trim();
      if (formStandard.trim()) addressPayload.standard = formStandard.trim();
      if (formBatch.trim()) addressPayload.batch = formBatch.trim();
      if (formGuardianName.trim()) addressPayload.guardianName = formGuardianName.trim();
      if (formGuardianPhone.trim()) addressPayload.guardianPhone = formGuardianPhone.trim();
      if (formGuardianRelation.trim()) addressPayload.guardianRelation = formGuardianRelation.trim();
      if (formAdmissionDate.trim()) addressPayload.admissionDate = formAdmissionDate.trim();

      const fullNotes = `${formNotes.trim()} [PLAN_VALIDITY:${formPlanMonths}_MONTHS]`.trim();

      const payload: any = {
        displayName: formName.trim(),
        primaryPhone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        notes: fullNotes || undefined,
        address: Object.keys(addressPayload).length > 0 ? addressPayload : undefined,
        types: ["MEMBER"],
      };

      if (editingPerson) {
        const res = await apiFetch(`/people/${editingPerson.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        if (res.error) throw new Error(res.error);
      } else {
        const res = await apiFetch("/people", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (res.error) throw new Error(res.error);
      }

      setIsModalOpen(false);
      fetchPeople();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save member.");
    } finally {
      setFormBusy(false);
    }
  };

  const feeCounts = {
    all: people.length,
    pending: people.filter((p) => {
      const fd = getPersonFeeDetails(p);
      return fd.feeStatus === "PENDING" || fd.feeStatus === "OVERDUE" || fd.feeStatus === "PARTIALLY_PAID";
    }).length,
    paid: people.filter((p) => getPersonFeeDetails(p).feeStatus === "PAID").length,
    upcoming: people.filter((p) => getPersonFeeDetails(p).feeStatus === "EXPIRING_SOON").length,
  };

  const filteredPeople = people.filter((p) => {
    const q = search.toLowerCase();
    const feeDetails = getPersonFeeDetails(p);

    const matchesSearch =
      p.displayName.toLowerCase().includes(q) ||
      Boolean(p.primaryPhone?.includes(q)) ||
      Boolean(p.email?.toLowerCase().includes(q)) ||
      Boolean(feeDetails.memberId?.toLowerCase().includes(q)) ||
      Boolean(feeDetails.standard?.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (typeFilter === "CUSTOMER") {
      if (!p.types?.some((t) => t.type === "CUSTOMER" || t.type === "MEMBER")) return false;
    } else if (typeFilter === "STUDENT") {
      if (!p.types?.some((t) => t.type === "STUDENT") && !p.studentProfile && !p.displayName.toLowerCase().includes("student")) return false;
    } else if (typeFilter === "STAFF") {
      if (!p.types?.some((t) => t.type === "EMPLOYEE" || t.type === "STAFF")) return false;
    }

    if (feeFilter === "PENDING") {
      return feeDetails.feeStatus === "PENDING" || feeDetails.feeStatus === "OVERDUE" || feeDetails.feeStatus === "PARTIALLY_PAID";
    }
    if (feeFilter === "PAID") {
      return feeDetails.feeStatus === "PAID";
    }
    if (feeFilter === "UPCOMING") {
      return feeDetails.feeStatus === "EXPIRING_SOON";
    }

    return true;
  });

  return (
    <View style={styles.container}>
      <AppHeader
        title="People Directory"
        subtitle="Manage students, members and fee billing"
        rightAction={
          <TouchableOpacity
            onPress={openCreateModal}
            style={styles.addBtn}
          >
            <Icon name="UserPlus" size={16} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      <View style={styles.searchWrap}>
        <SearchInput
          placeholder="Search by name, ID, phone or email..."
          value={search}
          onChangeText={setSearch}
        />

        {/* Type Filter Chips */}
        <View style={styles.typeFilterRow}>
          {(
            [
              { key: "ALL", label: "All Contacts" },
              { key: "CUSTOMER", label: "Members" },
              { key: "STUDENT", label: "Students" },
              { key: "STAFF", label: "Staff" },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTypeFilter(t.key)}
              style={[styles.typeChip, typeFilter === t.key && styles.typeChipActive]}
            >
              <Text style={[styles.typeChipText, typeFilter === t.key && styles.typeChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fee Filter Pills Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feeFilterRow}>
          <TouchableOpacity
            onPress={() => setFeeFilter("ALL")}
            style={[styles.feeChip, feeFilter === "ALL" && styles.feeChipActive]}
          >
            <Text style={[styles.feeChipText, feeFilter === "ALL" && styles.feeChipTextActive]}>
              All Records
            </Text>
            <View style={[styles.feeBadge, feeFilter === "ALL" && styles.feeBadgeActive]}>
              <Text style={[styles.feeBadgeText, feeFilter === "ALL" && styles.feeBadgeTextActive]}>
                {feeCounts.all}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFeeFilter("PENDING")}
            style={[styles.feeChip, feeFilter === "PENDING" && { backgroundColor: "#fff1f2", borderColor: "#fecdd3" }]}
          >
            <Text style={[styles.feeChipText, { color: colors.danger }, feeFilter === "PENDING" && { fontWeight: "800" }]}>
              Pending Fees
            </Text>
            <View style={[styles.feeBadge, { backgroundColor: feeFilter === "PENDING" ? colors.danger : "#fee2e2" }]}>
              <Text style={[styles.feeBadgeText, { color: feeFilter === "PENDING" ? "#ffffff" : colors.danger }]}>
                {feeCounts.pending}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFeeFilter("PAID")}
            style={[styles.feeChip, feeFilter === "PAID" && { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }]}
          >
            <Text style={[styles.feeChipText, { color: colors.emerald }, feeFilter === "PAID" && { fontWeight: "800" }]}>
              Paid Fees
            </Text>
            <View style={[styles.feeBadge, { backgroundColor: feeFilter === "PAID" ? colors.emerald : "#d1fae5" }]}>
              <Text style={[styles.feeBadgeText, { color: feeFilter === "PAID" ? "#ffffff" : colors.emerald }]}>
                {feeCounts.paid}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFeeFilter("UPCOMING")}
            style={[styles.feeChip, feeFilter === "UPCOMING" && { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}
          >
            <Text style={[styles.feeChipText, { color: "#b45309" }, feeFilter === "UPCOMING" && { fontWeight: "800" }]}>
              Upcoming (10-Day)
            </Text>
            <View style={[styles.feeBadge, { backgroundColor: feeFilter === "UPCOMING" ? "#d97706" : "#fef3c7" }]}>
              <Text style={[styles.feeBadgeText, { color: feeFilter === "UPCOMING" ? "#ffffff" : "#92400e" }]}>
                {feeCounts.upcoming}
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredPeople}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPeople(); }} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Loading directory members…</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Icon name="Users" size={28} color={colors.brand} />
              </View>
              <Text style={styles.emptyTitle}>
                {search ? "No matching members found" : "Directory is empty"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? `No contacts found for "${search}". Try checking the spelling or phone number.`
                  : "Add your members, students, or customers to start managing them."}
              </Text>
              {!search && (
                <PrimaryButton
                  title="+ Add First Member"
                  onPress={openCreateModal}
                  style={{ marginTop: spacing.md, minWidth: 180 }}
                />
              )}
            </View>
          )
        }
        renderItem={({ item }) => {
          const feeDetails = getPersonFeeDetails(item);
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setDetailPerson(item)}
              style={styles.memberCard}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>

              <View style={styles.memberMeta}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>{item.displayName}</Text>
                  {feeDetails.memberId && (
                    <View style={styles.memberIdBadge}>
                      <Text style={styles.memberIdText}>{feeDetails.memberId}</Text>
                    </View>
                  )}
                  <Badge tone="blue">{item.types[0]?.type || "MEMBER"}</Badge>
                </View>

                {/* Package & Slot Row */}
                {(feeDetails.standard || feeDetails.batch) && (
                  <View style={styles.tagRow}>
                    {feeDetails.standard && (
                      <View style={styles.packageChip}>
                        <Text style={styles.packageChipText}>{feeDetails.standard}</Text>
                      </View>
                    )}
                    {feeDetails.batch && (
                      <View style={styles.slotChip}>
                        <Text style={styles.slotChipText}>{feeDetails.batch}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Emergency Contact */}
                {feeDetails.guardianName && (
                  <Text style={styles.guardianText}>
                    Emergency: <Text style={{ fontWeight: "700" }}>{feeDetails.guardianName}</Text>
                    {feeDetails.guardianPhone ? ` (${feeDetails.guardianPhone})` : ""}
                  </Text>
                )}

                {/* Fee Plan & Validity Block */}
                {feeDetails.hasFeePlan && (
                  <View style={styles.feeInfoBlock}>
                    <View style={styles.feeTopLine}>
                      <Text style={styles.feePlanLabel}>{feeDetails.planLabel}</Text>
                      {feeDetails.feeAmountMinor > 0 && (
                        <Text style={styles.feePlanPrice}>
                          ₹{(feeDetails.feeAmountMinor / 100).toLocaleString("en-IN")}
                        </Text>
                      )}
                    </View>

                    {/* Status Pill */}
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: feeDetails.statusBadgeBg,
                          borderColor: feeDetails.statusBadgeBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: feeDetails.statusBadgeColor }]}>
                        {feeDetails.statusBadgeLabel}
                      </Text>
                    </View>

                    {/* Paid details line */}
                    {feeDetails.paidAmountMinor > 0 ? (
                      <Text style={styles.paidInfoText}>
                        Paid ₹{(feeDetails.paidAmountMinor / 100).toLocaleString("en-IN")}
                        {feeDetails.paidDateStr ? ` on ${feeDetails.paidDateStr}` : ""}
                        {feeDetails.paidMethod ? ` (${feeDetails.paidMethod})` : ""}
                      </Text>
                    ) : (
                      <Text style={[styles.paidInfoText, { color: colors.danger }]}>
                        Unpaid · Fee pending
                      </Text>
                    )}

                    {/* Primary Renewal Action Button */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openRenewalModal(item);
                      }}
                      style={styles.collectRenewBtn}
                    >
                      <Icon name="Zap" size={12} color="#ffffff" />
                      <Text style={styles.collectRenewBtnText}>Collect / Renew Fee</Text>
                    </TouchableOpacity>

                    {/* Quick 1-Tap Plan Switcher */}
                    <View style={styles.quickPlanRow}>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleQuickUpdatePlanValidity(item.id, 3);
                        }}
                        disabled={updatingPlanBusy === item.id}
                        style={[
                          styles.quickPlanBtn,
                          feeDetails.planMonths === 3 && styles.quickPlanBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickPlanBtnText,
                            feeDetails.planMonths === 3 && styles.quickPlanBtnTextActive,
                          ]}
                        >
                          {feeDetails.planMonths === 3 ? "3 Mo Plan" : "Set 3 Mo"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleQuickUpdatePlanValidity(item.id, 1);
                        }}
                        disabled={updatingPlanBusy === item.id}
                        style={[
                          styles.quickPlanBtn,
                          feeDetails.planMonths === 1 && styles.quickPlanBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickPlanBtnText,
                            feeDetails.planMonths === 1 && styles.quickPlanBtnTextActive,
                          ]}
                        >
                          {feeDetails.planMonths === 1 ? "1 Mo Plan" : "1 Mo"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <Text style={styles.memberPhone}>{item.primaryPhone || "No Phone number"}</Text>
              </View>

              {/* 1-Tap Quick Action Buttons */}
              {Boolean(item.primaryPhone) && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => Linking.openURL(`tel:${item.primaryPhone}`)}
                    style={styles.quickCallBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Icon name="Phone" size={13} color={colors.brand} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => Linking.openURL(`https://wa.me/${item.primaryPhone?.replace(/\D/g, "")}`)}
                    style={styles.quickWaBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Icon name="MessageSquare" size={13} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              )}

              <Icon name="ChevronRight" size={16} color={colors.subtle} />
            </TouchableOpacity>
          );
        }}
      />

      {/* Member Detail BottomSheet */}
      {Boolean(detailPerson) && (
        <BottomSheet
          visible={Boolean(detailPerson)}
          onClose={() => setDetailPerson(null)}
          title={detailPerson?.displayName || "Member Profile"}
          subtitle={detailPerson?.types[0]?.type || "Member"}
          footer={
            <View style={styles.detailFooter}>
              <PrimaryButton
                title="Collect / Renew Fee"
                onPress={() => openRenewalModal(detailPerson!)}
                style={{ flex: 1.2 }}
                icon={<Icon name="Zap" size={14} color="#ffffff" />}
              />
              <PrimaryButton
                title="Edit Details"
                onPress={() => openEditModal(detailPerson!)}
                variant="outline"
                style={{ flex: 0.8 }}
                icon={<Icon name="Edit2" size={14} color={colors.ink} />}
              />
            </View>
          }
        >
          {(() => {
            const fd = detailPerson ? getPersonFeeDetails(detailPerson) : null;
            return (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
                <View style={styles.detailBody}>
                  {/* Quick Collect & Renew Action Banner */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => openRenewalModal(detailPerson!)}
                    style={styles.detailRenewBanner}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailRenewTitle}>Next Fee Cycle Renewal</Text>
                      <Text style={styles.detailRenewSubtitle}>
                        Extend validity & record advance multi-month fee
                      </Text>
                    </View>
                    <View style={styles.detailRenewActionPill}>
                      <Icon name="Zap" size={12} color="#ffffff" />
                      <Text style={styles.detailRenewActionText}>Renew</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Quick Contact Row */}
                  {Boolean(detailPerson?.primaryPhone) && (
                    <View style={styles.contactActionRow}>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${detailPerson?.primaryPhone}`)}
                        style={[styles.contactBtn, { backgroundColor: colors.brandLight }]}
                      >
                        <Icon name="Phone" size={16} color={colors.brand} />
                        <Text style={[styles.contactBtnText, { color: colors.brand }]}>Call</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(
                            `https://wa.me/${detailPerson?.primaryPhone?.replace(/\D/g, "")}`
                          )
                        }
                        style={[styles.contactBtn, { backgroundColor: colors.emeraldLight }]}
                      >
                        <Icon name="MessageSquare" size={16} color={colors.emerald} />
                        <Text style={[styles.contactBtnText, { color: colors.emerald }]}>WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Card 1: Fee Plan & Validity Card */}
                  {fd && fd.hasFeePlan && (
                    <View style={styles.detailCard}>
                      <View style={styles.detailCardHeader}>
                        <Text style={styles.detailCardTitle}>Fee Plan & Validity</Text>
                        <View
                          style={[
                            styles.statusPill,
                            { backgroundColor: fd.statusBadgeBg, borderColor: fd.statusBadgeBorder },
                          ]}
                        >
                          <Text style={[styles.statusPillText, { color: fd.statusBadgeColor }]}>
                            {fd.statusBadgeLabel}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailMetricRow}>
                        <Text style={styles.detailMetricLabel}>Active Plan:</Text>
                        <Text style={styles.detailMetricVal}>{fd.planLabel}</Text>
                      </View>

                      {fd.feeAmountMinor > 0 && (
                        <View style={styles.detailMetricRow}>
                          <Text style={styles.detailMetricLabel}>Plan Fee:</Text>
                          <Text style={styles.detailMetricVal}>
                            ₹{(fd.feeAmountMinor / 100).toLocaleString("en-IN")}
                          </Text>
                        </View>
                      )}

                      {fd.paidAmountMinor > 0 && (
                        <View style={styles.detailMetricRow}>
                          <Text style={styles.detailMetricLabel}>Amount Paid:</Text>
                          <Text style={[styles.detailMetricVal, { color: colors.emerald }]}>
                            ₹{(fd.paidAmountMinor / 100).toLocaleString("en-IN")} ({fd.paidMethod || "UPI"})
                          </Text>
                        </View>
                      )}

                      {fd.paidDateStr && (
                        <View style={styles.detailMetricRow}>
                          <Text style={styles.detailMetricLabel}>Payment Date:</Text>
                          <Text style={styles.detailMetricVal}>{fd.paidDateStr}</Text>
                        </View>
                      )}

                      {fd.validUntilStr && (
                        <View style={styles.detailMetricRow}>
                          <Text style={styles.detailMetricLabel}>Expires On:</Text>
                          <Text style={styles.detailMetricVal}>
                            {fd.validUntilStr}
                            {fd.daysRemaining !== null
                              ? ` (${fd.daysRemaining >= 0 ? `${fd.daysRemaining} days left` : `Expired ${Math.abs(fd.daysRemaining)}d ago`})`
                              : ""}
                          </Text>
                        </View>
                      )}

                      {/* Quick 1-Tap Validity Switcher in Detail */}
                      <View style={{ marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.lineLight }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 4 }}>
                          1-Tap Plan Validity Switcher:
                        </Text>
                        <View style={styles.quickPlanRow}>
                          {[1, 2, 3, 6, 12].map((m) => (
                            <TouchableOpacity
                              key={m}
                              onPress={() => handleQuickUpdatePlanValidity(detailPerson!.id, m)}
                              disabled={updatingPlanBusy === detailPerson!.id}
                              style={[
                                styles.quickPlanBtn,
                                fd.planMonths === m && styles.quickPlanBtnActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.quickPlanBtnText,
                                  fd.planMonths === m && styles.quickPlanBtnTextActive,
                                ]}
                              >
                                {fd.planMonths === m ? `${m}M Plan` : `${m}M`}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Card 2: Membership / Admission Card */}
                  {fd && (fd.memberId || fd.standard || fd.batch || fd.guardianName) && (
                    <View style={styles.detailCard}>
                      <View style={styles.detailCardHeader}>
                        <Text style={styles.detailCardTitle}>Membership & Admission</Text>
                        {fd.memberId && (
                          <View style={styles.memberIdBadge}>
                            <Text style={styles.memberIdText}>{fd.memberId}</Text>
                          </View>
                        )}
                      </View>

                      {fd.admissionDateStr && (
                        <View style={styles.detailMetricRow}>
                          <Text style={styles.detailMetricLabel}>Admission Date:</Text>
                          <Text style={styles.detailMetricVal}>{fd.admissionDateStr}</Text>
                        </View>
                      )}

                      {fd.standard && (
                        <View style={styles.detailMetricRow}>
                          <Text style={styles.detailMetricLabel}>Package / Course:</Text>
                          <Text style={styles.detailMetricVal}>{fd.standard}</Text>
                        </View>
                      )}

                      {fd.batch && (
                        <View style={styles.detailMetricRow}>
                          <Text style={styles.detailMetricLabel}>Workout Slot / Batch:</Text>
                          <Text style={styles.detailMetricVal}>{fd.batch}</Text>
                        </View>
                      )}

                      {fd.guardianName && (
                        <View style={styles.detailMetricRow}>
                          <Text style={styles.detailMetricLabel}>Emergency Contact:</Text>
                          <Text style={styles.detailMetricVal}>
                            {fd.guardianName}
                            {fd.guardianPhone ? ` (${fd.guardianPhone})` : ""}
                            {fd.guardianRelation ? ` • ${fd.guardianRelation}` : ""}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Contact Information */}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Primary Phone</Text>
                    <Text style={styles.infoValue}>{detailPerson?.primaryPhone || "—"}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email Address</Text>
                    <Text style={styles.infoValue}>{detailPerson?.email || "—"}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Address</Text>
                    <Text style={styles.infoValue}>
                      {detailPerson?.address?.addressLine1 || detailPerson?.address?.street || "—"}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Notes</Text>
                    <Text style={styles.infoValue}>{detailPerson?.notes || "—"}</Text>
                  </View>
                </View>
              </ScrollView>
            );
          })()}
        </BottomSheet>
      )}

      {/* Renewal Fee BottomSheet Modal (12-Month Calendar Grid) */}
      {Boolean(renewalPerson) && (
        <BottomSheet
          visible={renewalModalOpen}
          onClose={() => setRenewalModalOpen(false)}
          title="Collect Fees / Renew Plan"
          subtitle={renewalPerson ? `${renewalPerson.displayName} - 12-Month Fee Calendar` : ""}
          footer={
            <View style={styles.modalFooterRow}>
              <PrimaryButton
                title="Cancel"
                variant="outline"
                onPress={() => setRenewalModalOpen(false)}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title={
                  renewalBusy
                    ? "Recording…"
                    : `Record INR ${Number(renewalAmount) > 0 ? Number(renewalAmount).toLocaleString("en-IN") : "0"}`
                }
                onPress={handleSaveRenewal}
                disabled={renewalBusy || renewalSelectedMonths.length === 0 || !renewalAmount || Number(renewalAmount) <= 0}
                loading={renewalBusy}
                style={{ flex: 1 }}
              />
            </View>
          }
        >
          {(() => {
            if (!renewalPerson) return null;
            const paidMonths = getPersonPaidMonths(renewalPerson, renewalYear);
            const now = new Date();
            const currentYyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const selectedSorted = [...renewalSelectedMonths].sort();
            const selectedLabels = selectedSorted.map((ym) => {
              const [y, m] = ym.split("-");
              const idx = parseInt(m, 10) - 1;
              return `${monthNames[idx] || m} ${y}`;
            });

            return (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
                <View style={styles.formContainer}>
                  {/* Member Summary Header */}
                  <View style={styles.renewalHeaderBox}>
                    <Text style={styles.renewalHeaderName}>{renewalPerson?.displayName}</Text>
                    <Text style={styles.renewalHeaderPhone}>{renewalPerson?.primaryPhone || "No Phone"}</Text>
                  </View>

                  {/* Year Switcher Header */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
                    <Text style={styles.inputLabel}>12-Month Fee Calendar</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setRenewalYear((y) => y - 1)}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.lineLight, backgroundColor: "#fff" }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted }}>&lt; {renewalYear - 1}</Text>
                      </TouchableOpacity>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.brandLight }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.brand }}>{renewalYear}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setRenewalYear((y) => y + 1)}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.lineLight, backgroundColor: "#fff" }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted }}>{renewalYear + 1} &gt;</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Quick Mark Buttons */}
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: spacing.sm }}>
                    {[
                      { count: 1, label: "+1 Mo" },
                      { count: 2, label: "+2 Mo" },
                      { count: 3, label: "+3 Mo" },
                      { count: 6, label: "+6 Mo" },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.count}
                        onPress={() => quickSelectRenewalMonths(opt.count)}
                        style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.lineLight, backgroundColor: "#fff" }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "650", color: colors.ink }}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                    {renewalSelectedMonths.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setRenewalSelectedMonths([])}
                        style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fff1f2", marginLeft: "auto" }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "650", color: "#b91c1c" }}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 12 Months Grid */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md }}>
                    {monthNames.map((mName, idx) => {
                      const mNumStr = String(idx + 1).padStart(2, "0");
                      const yyyyMm = `${renewalYear}-${mNumStr}`;
                      const isPaid = paidMonths.has(yyyyMm);
                      const isCurrent = yyyyMm === currentYyyyMm;
                      const isSelected = renewalSelectedMonths.includes(yyyyMm);

                      let bg = "#fff";
                      let bColor = colors.lineLight;
                      let txtColor = colors.ink;

                      if (isSelected) {
                        bg = "#eff6ff";
                        bColor = colors.brand;
                        txtColor = colors.brand;
                      } else if (isPaid) {
                        bg = "#f0fdf4";
                        bColor = "#86efac";
                        txtColor = "#166534";
                      } else if (isCurrent) {
                        bg = "#fffbeb";
                        bColor = "#f59e0b";
                        txtColor = "#92400e";
                      }

                      return (
                        <TouchableOpacity
                          key={yyyyMm}
                          disabled={isPaid}
                          onPress={() => toggleRenewalMonth(yyyyMm, isPaid)}
                          style={{
                            width: "23%",
                            paddingVertical: 7,
                            paddingHorizontal: 4,
                            borderRadius: radius.md,
                            backgroundColor: bg,
                            borderWidth: isSelected ? 2 : 1,
                            borderColor: bColor,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: "750", color: txtColor }}>{mName}</Text>
                          {isPaid ? (
                            <Text style={{ fontSize: 8.5, fontWeight: "800", color: "#166534", marginTop: 2 }}>PAID</Text>
                          ) : isSelected ? (
                            <Text style={{ fontSize: 8.5, fontWeight: "800", color: colors.brand, marginTop: 2 }}>MARKED</Text>
                          ) : isCurrent ? (
                            <Text style={{ fontSize: 8.5, fontWeight: "800", color: "#92400e", marginTop: 2 }}>CURRENT</Text>
                          ) : (
                            <Text style={{ fontSize: 8.5, color: colors.muted, marginTop: 2 }}>Unpaid</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Selected Months Summary */}
                  <View style={{ padding: spacing.sm, borderRadius: radius.md, backgroundColor: renewalSelectedMonths.length > 0 ? "#eff6ff" : "#fffbeb", borderWidth: 1, borderColor: renewalSelectedMonths.length > 0 ? "#bfdbfe" : "#fde68a", marginBottom: spacing.md }}>
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: renewalSelectedMonths.length > 0 ? colors.brand : "#92400e" }}>
                      {renewalSelectedMonths.length > 0
                        ? `Marked for Payment (${renewalSelectedMonths.length}): ${selectedLabels.join(", ")}`
                        : "No months marked. Click on one or more unpaid months above."}
                    </Text>
                  </View>

                  {/* Renewal Fee Amount (100% manual input!) */}
                  <View style={styles.formGroup}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                      <Text style={styles.inputLabel}>Total Fee Amount (INR) *</Text>
                      <Text style={{ fontSize: 10.5, color: colors.muted }}>Manual Entry (No auto-calc)</Text>
                    </View>
                    <TextInput
                      keyboardType="numeric"
                      value={renewalAmount}
                      onChangeText={setRenewalAmount}
                      placeholder="Enter amount manually (e.g. 6000)"
                      placeholderTextColor={colors.muted}
                      style={styles.formInput}
                    />
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                      Type the exact received amount manually. No automatic multiplication.
                    </Text>
                  </View>

                  {/* Payment Mode */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Payment Mode</Text>
                    <View style={styles.planSelectorRow}>
                      {(["UPI", "CASH", "BANK_TRANSFER"] as const).map((m) => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setRenewalMethod(m)}
                          style={[
                            styles.planChip,
                            renewalMethod === m && styles.planChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.planChipText,
                              renewalMethod === m && styles.planChipTextActive,
                            ]}
                          >
                            {m === "BANK_TRANSFER" ? "Bank Transfer" : m}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Reference / UTR Number (Optional) */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Transaction Reference / UTR (Optional)</Text>
                    <TextInput
                      value={renewalReference}
                      onChangeText={setRenewalReference}
                      placeholder="e.g. UPI Ref / Cheque No"
                      placeholderTextColor={colors.muted}
                      style={styles.formInput}
                    />
                  </View>

                  {/* Notes */}
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Notes (Optional)</Text>
                    <TextInput
                      value={renewalNotes}
                      onChangeText={setRenewalNotes}
                      placeholder="e.g. Paid in full for marked months"
                      placeholderTextColor={colors.muted}
                      style={styles.formInput}
                    />
                  </View>
                </View>
              </ScrollView>
            );
          })()}
        </BottomSheet>
      )}

      {/* Add / Edit Member Modal */}
      <BottomSheet
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPerson ? "Edit Member Details" : "Add New Member"}
        subtitle="Complete Member Registration Form"
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              onPress={() => setIsModalOpen(false)}
              variant="outline"
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={formBusy ? "Saving…" : "Save Changes"}
              onPress={handleSave}
              loading={formBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        {/* Step Navigation Pills */}
        <View style={styles.stepPillRow}>
          <TouchableOpacity
            onPress={() => setActiveTab("personal")}
            style={[styles.stepPill, activeTab === "personal" && styles.stepPillActive]}
          >
            <Text style={[styles.stepPillText, activeTab === "personal" && styles.stepPillTextActive]}>
              1. Personal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("address")}
            style={[styles.stepPill, activeTab === "address" && styles.stepPillActive]}
          >
            <Text style={[styles.stepPillText, activeTab === "address" && styles.stepPillTextActive]}>
              2. Address
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("more")}
            style={[styles.stepPill, activeTab === "more" && styles.stepPillActive]}
          >
            <Text style={[styles.stepPillText, activeTab === "more" && styles.stepPillTextActive]}>
              3. More Info
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
          {activeTab === "personal" && (
            <View style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Ramesh Kumar"
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Primary Phone *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="+91 9876543210"
                  keyboardType="phone-pad"
                  value={formPhone}
                  onChangeText={setFormPhone}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="ramesh@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formEmail}
                  onChangeText={setFormEmail}
                />
              </View>
            </View>
          )}

          {activeTab === "address" && (
            <View style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Street / Building Address</Text>
                <TextInput
                  style={[styles.formInput, { height: 70 }]}
                  placeholder="e.g. Shop 4, Galaxy Plaza, Main Market"
                  multiline
                  value={formAddress}
                  onChangeText={setFormAddress}
                />
              </View>
            </View>
          )}

          {activeTab === "more" && (
            <View style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Plan Validity / Cycle</Text>
                <View style={styles.planSelectorRow}>
                  {[1, 2, 3, 4, 5, 6, 12].map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setFormPlanMonths(m)}
                      style={[styles.planChip, formPlanMonths === m && styles.planChipActive]}
                    >
                      <Text style={[styles.planChipText, formPlanMonths === m && styles.planChipTextActive]}>
                        {m === 12 ? "1 Year" : `${m} Mo`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Member ID / Reg No</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. GYM-1001"
                  value={formAdmissionNo}
                  onChangeText={setFormAdmissionNo}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Membership Package / Course</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Strength Training"
                  value={formStandard}
                  onChangeText={setFormStandard}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Workout Slot / Batch</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Morning 6-8 AM"
                  value={formBatch}
                  onChangeText={setFormBatch}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Emergency Contact Name</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Ramesh Sharma"
                  value={formGuardianName}
                  onChangeText={setFormGuardianName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Emergency Contact Phone</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 98223 34455"
                  keyboardType="phone-pad"
                  value={formGuardianPhone}
                  onChangeText={setFormGuardianPhone}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Emergency Contact Relation</Text>
                <View style={styles.planSelectorRow}>
                  {["Self", "Father", "Mother", "Spouse", "Other"].map((rel) => (
                    <TouchableOpacity
                      key={rel}
                      onPress={() => setFormGuardianRelation(rel)}
                      style={[styles.planChip, formGuardianRelation === rel && styles.planChipActive]}
                    >
                      <Text style={[styles.planChipText, formGuardianRelation === rel && styles.planChipTextActive]}>
                        {rel}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Admission / Enrollment Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 2026-07-01"
                  value={formAdmissionDate}
                  onChangeText={setFormAdmissionDate}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Internal Profile Notes</Text>
                <TextInput
                  style={[styles.formInput, { height: 70 }]}
                  placeholder="Additional details, preferences or background..."
                  multiline
                  value={formNotes}
                  onChangeText={setFormNotes}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  feeFilterRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingBottom: 2,
  },
  feeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  feeChipActive: {
    backgroundColor: colors.brandNavy,
    borderColor: colors.brandNavy,
  },
  feeChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  feeChipTextActive: {
    color: "#ffffff",
  },
  feeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  feeBadgeActive: {
    backgroundColor: "#ffffff",
  },
  feeBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.muted,
  },
  feeBadgeTextActive: {
    color: colors.brandNavy,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    marginTop: 2,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.brand,
  },
  memberMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  memberName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.ink,
  },
  memberIdBadge: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  memberIdText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
    flexWrap: "wrap",
  },
  packageChip: {
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#ccfbf1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  packageChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f766e",
  },
  slotChip: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  guardianText: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 3,
  },
  feeInfoBlock: {
    marginTop: 6,
    padding: spacing.xs + 2,
    backgroundColor: "#f8fafc",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineLight,
    gap: 4,
  },
  feeTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feePlanLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink,
  },
  feePlanPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  paidInfoText: {
    fontSize: 11,
    color: colors.muted,
  },
  quickPlanRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 3,
    flexWrap: "wrap",
  },
  quickPlanBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.lineDark,
    backgroundColor: colors.surface,
  },
  quickPlanBtnActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  quickPlanBtnText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.muted,
  },
  quickPlanBtnTextActive: {
    color: colors.brand,
    fontWeight: "800",
  },
  memberPhone: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  detailBody: {
    gap: spacing.md,
  },
  detailCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.lineLight,
    gap: spacing.xs,
  },
  detailCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  detailCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  detailMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  detailMetricLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  detailMetricVal: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
  },
  contactActionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  infoRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineLight,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 2,
  },
  detailFooter: {
    flexDirection: "row",
    gap: spacing.md,
  },
  stepPillRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  stepPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
  },
  stepPillActive: {
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  stepPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  stepPillTextActive: {
    color: colors.brand,
  },
  formContainer: {
    gap: spacing.md,
  },
  formGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkSecondary,
  },
  formInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 42,
    fontSize: 13.5,
    color: colors.ink,
  },
  planSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  planChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  planChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  planChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  planChipTextActive: {
    color: colors.brand,
    fontWeight: "800",
  },
  modalFooterRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  typeFilterRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  typeChipActive: {
    backgroundColor: colors.brandNavy,
    borderColor: colors.brandNavy,
  },
  typeChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  typeChipTextActive: {
    color: "#ffffff",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: spacing.xs,
    marginRight: spacing.xs,
  },
  quickCallBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  quickWaBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.whatsapp,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: colors.muted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
  },
  collectRenewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    marginTop: 6,
    marginBottom: 4,
  },
  collectRenewBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#ffffff",
  },
  detailRenewBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailRenewTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brand,
  },
  detailRenewSubtitle: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  detailRenewActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brand,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  detailRenewActionText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
  },
  renewalHeaderBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.lineLight,
  },
  renewalHeaderName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  renewalHeaderPhone: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  renewalPreviewCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  renewalPreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  renewalPreviewTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.ink,
  },
  renewalAlertNote: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 15,
    fontStyle: "italic",
  },
});
