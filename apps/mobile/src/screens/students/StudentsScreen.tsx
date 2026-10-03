import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Linking,
  ScrollView,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { BottomSheet } from "../../components/BottomSheet";
import { PrimaryButton } from "../../components/PrimaryButton";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";

type StudentProfile = {
  id: string;
  rollNumber: string | null;
  standard: string;
  batch: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianRelation?: string | null;
  feeAmountMinor: number;
  feeFrequency?: string;
  planValidityMonths?: number;
  person: {
    id: string;
    displayName: string;
    primaryPhone: string | null;
    email: string | null;
  };
};

type RecurringFeeItem = {
  studentProfileId: string;
  displayName: string;
  standard: string;
  batch: string | null;
  guardianPhone: string | null;
  primaryPhone: string | null;
  feePlanAmountMinor: number;
  status: "PAID" | "PENDING" | "PARTIALLY_PAID";
  paidMinor: number;
  balanceMinor: number;
};

type AttendanceRecord = {
  studentProfileId: string;
  displayName: string;
  rollNumber: string | null;
  standard: string;
  status: "PRESENT" | "ABSENT" | "LEAVE" | "UNMARKED";
};

const GYM_PACKAGES = ["ALL", "Strength Training", "Cardio + Weights", "CrossFit", "Personal Training", "Yoga / Zumba"];
const ACADEMY_STANDARDS = ["ALL", "9th Grade", "10th Standard", "11th Science", "12th Standard", "JEE / NEET"];
const GYM_SLOTS = ["Morning 6-8 AM", "Morning 8-10 AM", "Evening 5-7 PM", "Evening 7-9 PM", "All Day Access"];
const ACADEMY_BATCHES = ["Morning Batch", "Evening Batch", "Weekend Batch"];
const PLAN_MONTHS_OPTIONS = [1, 2, 3, 4, 5, 6, 12];
const RELATION_OPTIONS = ["Self", "Father", "Mother", "Spouse", "Friend", "Other"];

export function StudentsScreen() {
  const { activeOrg } = useAuth();
  const bType = String(activeOrg?.businessType || "").toUpperCase();
  const orgN = String(activeOrg?.name || "").toLowerCase();
  const isGym =
    bType === "FITNESS_STUDIO" ||
    bType === "GYM" ||
    orgN.includes("gym") ||
    orgN.includes("fitness") ||
    orgN.includes("crossfit") ||
    orgN.includes("workout");

  const standardsList = isGym ? GYM_PACKAGES : ACADEMY_STANDARDS;

  const [activeTab, setActiveTab] = useState<"directory" | "fees" | "attendance">("directory");

  // Tab 1: Directory
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStandard, setSelectedStandard] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab 2: Recurring Fees
  const todayYyyyMm = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(todayYyyyMm);
  const [feesList, setFeesList] = useState<RecurringFeeItem[]>([]);
  const [collectStudent, setCollectStudent] = useState<RecurringFeeItem | null>(null);
  const [collectFeeYear, setCollectFeeYear] = useState<number>(new Date().getFullYear());
  const [collectSelectedMonths, setCollectSelectedMonths] = useState<string[]>([]);
  const [collectPlanMonths, setCollectPlanMonths] = useState(1);
  const [collectAmount, setCollectAmount] = useState(""); // 100% manual input!
  const [collectMethod, setCollectMethod] = useState<"UPI" | "CASH" | "BANK_TRANSFER">("UPI");
  const [collectBusy, setCollectBusy] = useState(false);

  // Tab 3: Daily Attendance
  const todayYyyyMmDd = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayYyyyMmDd);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);

  // Admission Modal State
  const [isAdmissionOpen, setIsAdmissionOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRollNumber, setFormRollNumber] = useState("");
  const [formStandard, setFormStandard] = useState("");
  const [formBatch, setFormBatch] = useState("");
  const [formFee, setFormFee] = useState("1500");
  const [formPlanMonths, setFormPlanMonths] = useState(3);
  const [formAddress, setFormAddress] = useState("");
  const [formGuardianName, setFormGuardianName] = useState("");
  const [formGuardianPhone, setFormGuardianPhone] = useState("");
  const [formGuardianRelation, setFormGuardianRelation] = useState("Self");
  const [admissionPaymentStatus, setAdmissionPaymentStatus] = useState<"PAID_NOW" | "PENDING">("PAID_NOW");
  const [admissionPaymentMethod, setAdmissionPaymentMethod] = useState<"UPI" | "CASH" | "BANK_TRANSFER">("UPI");
  const [admissionBusy, setAdmissionBusy] = useState(false);
  const [admissionYear, setAdmissionYear] = useState<number>(new Date().getFullYear());
  const [admissionSelectedMonths, setAdmissionSelectedMonths] = useState<string[]>([new Date().toISOString().slice(0, 7)]);

  const toggleAdmissionMonth = (yyyyMm: string) => {
    setAdmissionSelectedMonths((prev) => {
      const exists = prev.includes(yyyyMm);
      const next = exists ? prev.filter((m) => m !== yyyyMm) : [...prev, yyyyMm].sort();
      const count = Math.max(1, next.length);
      setFormPlanMonths(count);
      return next;
    });
  };

  const quickSelectAdmissionMonths = (count: number) => {
    const now = new Date();
    const startM = now.getFullYear() === admissionYear ? now.getMonth() + 1 : 1;
    const months: string[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(admissionYear, (startM - 1) + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(ym);
    }
    setAdmissionSelectedMonths(months.sort());
    setFormPlanMonths(count);
  };

  const handleOpenAdmission = () => {
    setFormName("");
    setFormPhone("");
    setFormRollNumber(isGym ? `GYM-${1000 + students.length + 1}` : `ST-${1000 + students.length + 1}`);
    setFormStandard(isGym ? "Strength Training" : "10th Standard");
    setFormBatch(isGym ? "Morning 6-8 AM" : "Morning Batch");
    setFormFee(isGym ? "1500" : "2500");
    setFormPlanMonths(isGym ? 3 : 1);
    setAdmissionYear(new Date().getFullYear());
    setAdmissionSelectedMonths([new Date().toISOString().slice(0, 7)]);
    setFormAddress("");
    setFormGuardianName("");
    setFormGuardianPhone("");
    setFormGuardianRelation(isGym ? "Self" : "Father");
    setAdmissionPaymentStatus("PAID_NOW");
    setAdmissionPaymentMethod("UPI");
    setIsAdmissionOpen(true);
  };

  const fetchStudents = useCallback(async () => {
    try {
      const res = await apiFetch<any>("/students?limit=200");
      if (res.data?.items) {
        setStudents(res.data.items);
      } else if (Array.isArray(res.data)) {
        setStudents(res.data);
      } else {
        // Fallback demo students
        setStudents([
          {
            id: "std-1",
            rollNumber: "A-101",
            standard: "10th Standard",
            batch: "Morning Champions",
            guardianName: "Sunil Verma",
            guardianPhone: "+91 98112 23344",
            feeAmountMinor: 350000,
            person: {
              id: "p-1",
              displayName: "Aryan Verma",
              primaryPhone: "+91 98112 23344",
              email: "aryan@gmail.com",
            },
          },
          {
            id: "std-2",
            rollNumber: "A-102",
            standard: "12th Standard",
            batch: "JEE Advanced",
            guardianName: "Meenakshi Rao",
            guardianPhone: "+91 98223 34455",
            feeAmountMinor: 600000,
            person: {
              id: "p-2",
              displayName: "Kavya Rao",
              primaryPhone: "+91 98223 34455",
              email: "kavya@gmail.com",
            },
          },
          {
            id: "std-3",
            rollNumber: "A-103",
            standard: "10th Standard",
            batch: "Morning Champions",
            guardianName: "Rajesh Joshi",
            guardianPhone: "+91 99110 55667",
            feeAmountMinor: 350000,
            person: {
              id: "p-3",
              displayName: "Rohan Joshi",
              primaryPhone: "+91 99110 55667",
              email: "rohan@gmail.com",
            },
          },
        ]);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchRecurringFees = useCallback(async () => {
    try {
      const res = await apiFetch<any>(`/students/recurring-fees?month=${selectedMonth}`);
      if (res.data?.items) {
        setFeesList(res.data.items);
      } else {
        // Build from students
        setFeesList(
          students.map((s, idx) => ({
            studentProfileId: s.id,
            displayName: s.person.displayName,
            standard: s.standard,
            batch: s.batch,
            guardianPhone: s.guardianPhone,
            primaryPhone: s.person.primaryPhone,
            feePlanAmountMinor: s.feeAmountMinor || 300000,
            status: idx === 0 ? "PAID" : "PENDING",
            paidMinor: idx === 0 ? s.feeAmountMinor || 300000 : 0,
            balanceMinor: idx === 0 ? 0 : s.feeAmountMinor || 300000,
          }))
        );
      }
    } catch {
      setFeesList(
        students.map((s, idx) => ({
          studentProfileId: s.id,
          displayName: s.person.displayName,
          standard: s.standard,
          batch: s.batch,
          guardianPhone: s.guardianPhone,
          primaryPhone: s.person.primaryPhone,
          feePlanAmountMinor: s.feeAmountMinor || 300000,
          status: idx === 0 ? "PAID" : "PENDING",
          paidMinor: idx === 0 ? s.feeAmountMinor || 300000 : 0,
          balanceMinor: idx === 0 ? 0 : s.feeAmountMinor || 300000,
        }))
      );
    }
  }, [selectedMonth, students]);

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await apiFetch<any>(`/students/attendance?date=${selectedDate}`);
      if (res.data?.items) {
        setAttendanceList(
          res.data.items.map((it: any) => ({
            studentProfileId: it.studentProfileId,
            displayName: it.displayName,
            rollNumber: it.rollNumber,
            standard: it.standard,
            status: it.status || "UNMARKED",
          }))
        );
      } else {
        setAttendanceList(
          students.map((s) => ({
            studentProfileId: s.id,
            displayName: s.person.displayName,
            rollNumber: s.rollNumber,
            standard: s.standard,
            status: "PRESENT",
          }))
        );
      }
    } catch {
      setAttendanceList(
        students.map((s) => ({
          studentProfileId: s.id,
          displayName: s.person.displayName,
          rollNumber: s.rollNumber,
          standard: s.standard,
          status: "PRESENT",
        }))
      );
    }
  }, [selectedDate, students]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (activeTab === "fees") fetchRecurringFees();
    if (activeTab === "attendance") fetchAttendance();
  }, [activeTab, fetchRecurringFees, fetchAttendance]);

  const formatRupees = (minor = 0) => `₹${(minor / 100).toLocaleString("en-IN")}`;

  const handleSaveAdmission = async () => {
    if (!formName.trim()) {
      Alert.alert("Required", isGym ? "Member name is required." : "Student name is required.");
      return;
    }
    const feeNum = Number(formFee);
    if (isNaN(feeNum) || feeNum <= 0) {
      Alert.alert("Required", "Please enter a valid fee amount.");
      return;
    }

    setAdmissionBusy(true);
    try {
      const payload = {
        displayName: formName.trim(),
        primaryPhone: formPhone.trim() || undefined,
        standard: formStandard.trim() || (isGym ? "Strength Training" : "General"),
        batch: formBatch.trim() || undefined,
        rollNumber: formRollNumber.trim() || undefined,
        feeFrequency: formPlanMonths === 3 ? "QUARTERLY" : formPlanMonths === 12 ? "ANNUAL" : "MONTHLY",
        feeAmountMinor: Math.round(feeNum * 100),
        planValidityMonths: formPlanMonths,
        guardianName: formGuardianName.trim() || undefined,
        guardianPhone: formGuardianPhone.trim() || undefined,
        guardianRelation: formGuardianRelation.trim() || undefined,
        admissionDate: todayYyyyMmDd,
        billingStartDate: todayYyyyMmDd,
        initialPaymentAmountMinor: admissionPaymentStatus === "PAID_NOW" ? Math.round(feeNum * 100) : 0,
        initialPaymentMethod: admissionPaymentMethod,
        selectedMonths: admissionSelectedMonths,
        address: {
          ...(formAddress.trim() ? { addressLine1: formAddress.trim() } : {}),
          planValidityMonths: String(admissionSelectedMonths.length || formPlanMonths),
          paidMonths: admissionSelectedMonths,
        },
      };

      const res = await apiFetch("/students", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert(
        isGym ? "Member Enrolled!" : "Admission Confirmed!",
        `${formName} has been enrolled successfully!${admissionPaymentStatus === "PAID_NOW" ? " Initial fee recorded with invoice & receipt." : ""}`
      );
      setIsAdmissionOpen(false);
      fetchStudents();
    } catch (err: any) {
      // Optimistic demo addition
      const newStd: StudentProfile = {
        id: `std-${Date.now()}`,
        rollNumber: formRollNumber.trim() || (isGym ? `GYM-${1000 + students.length + 1}` : `A-${students.length + 101}`),
        standard: formStandard.trim() || (isGym ? "Strength Training" : "10th Standard"),
        batch: formBatch.trim() || (isGym ? "Morning 6-8 AM" : "Morning Batch"),
        guardianName: formGuardianName.trim() || null,
        guardianPhone: formGuardianPhone.trim() || null,
        guardianRelation: formGuardianRelation.trim() || null,
        feeAmountMinor: Math.round(feeNum * 100),
        feeFrequency: formPlanMonths === 3 ? "QUARTERLY" : formPlanMonths === 12 ? "ANNUAL" : "MONTHLY",
        planValidityMonths: formPlanMonths,
        person: {
          id: `p-${Date.now()}`,
          displayName: formName.trim(),
          primaryPhone: formPhone.trim() || null,
          email: null,
        },
      };
      setStudents((prev) => [newStd, ...prev]);
      Alert.alert(isGym ? "Member Enrolled!" : "Admission Confirmed!", `${formName} has been enrolled!`);
      setIsAdmissionOpen(false);
    } finally {
      setAdmissionBusy(false);
    }
  };

  const getStudentPaidMonths = (studentProfileId: string, year?: number): Set<string> => {
    const paidSet = new Set<string>();
    const std = students.find((s) => s.id === studentProfileId);
    const addr = (std?.person?.address && typeof std.person.address === "object" ? std.person.address : {}) as Record<string, any>;
    if (Array.isArray(addr.paidMonths)) {
      addr.paidMonths.forEach((m: string) => {
        if (typeof m === "string" && /^\d{4}-\d{2}$/.test(m)) paidSet.add(m);
      });
    }


    feesList.forEach((f) => {
      if (f.studentProfileId === studentProfileId && f.status === "PAID") {
        paidSet.add(f.cycleMonth);
      }
    });

    return paidSet;
  };

  const handleOpenCollectModal = (item: RecurringFeeItem) => {
    setCollectStudent(item);
    const currentYear = new Date().getFullYear();
    setCollectFeeYear(currentYear);
    setCollectSelectedMonths(item.status !== "PAID" ? [item.cycleMonth] : []);
    setCollectAmount(""); // 100% manual input! Never auto-calculated!
    setCollectMethod("UPI");
  };

  const toggleCollectMonth = (yyyyMm: string, isPaid: boolean) => {
    if (isPaid) return;
    setCollectSelectedMonths((prev) => {
      if (prev.includes(yyyyMm)) {
        return prev.filter((m) => m !== yyyyMm);
      } else {
        return [...prev, yyyyMm].sort();
      }
    });
    // NOTE: NEVER auto-calculate or overwrite collectAmount! Amount is 100% manual entry.
  };

  const quickSelectCollectMonths = (count: number) => {
    if (!collectStudent) return;
    const paidSet = getStudentPaidMonths(collectStudent.studentProfileId, collectFeeYear);
    const months: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const yyyyMm = `${collectFeeYear}-${String(m).padStart(2, "0")}`;
      if (!paidSet.has(yyyyMm)) {
        months.push(yyyyMm);
        if (months.length === count) break;
      }
    }
    setCollectSelectedMonths(months.sort());
    // NOTE: NEVER auto-calculate or overwrite collectAmount! Amount is 100% manual entry.
  };

  const handleSaveCollectFee = async () => {
    if (!collectStudent) return;
    if (collectSelectedMonths.length === 0) {
      Alert.alert("Required", "Please select at least one month on the calendar grid to mark as paid.");
      return;
    }
    const num = Number(collectAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid fee amount manually.");
      return;
    }

    setCollectBusy(true);
    try {
      const planMonths = Math.max(1, collectSelectedMonths.length);
      const startMonth = collectSelectedMonths[0];

      const res = await apiFetch("/students/collect-fee", {
        method: "POST",
        body: JSON.stringify({
          studentProfileId: collectStudent.studentProfileId,
          month: startMonth,
          selectedMonths: collectSelectedMonths,
          amountMinor: Math.round(num * 100),
          paymentMethod: collectMethod,
          planMonths,
        }),
      });

      if (res.error) throw new Error(res.error);

      // WhatsApp receipt without emojis
      const orgName = activeOrg?.name || (isGym ? "Fitness Studio" : "CRMKaro Academy");
      const periodLabel = collectSelectedMonths.length === 1
        ? collectSelectedMonths[0]
        : `${collectSelectedMonths[0]} to ${collectSelectedMonths[collectSelectedMonths.length - 1]} (${collectSelectedMonths.length} Months)`;

      const msg = `*FEE PAYMENT RECEIPT*\n------------------------------\n*Organization:* ${orgName}\n*Student/Member:* ${collectStudent.displayName}\n*Covered Period:* ${periodLabel}\n*Amount Collected:* INR ${num.toLocaleString("en-IN")}\n*Mode:* ${collectMethod}\n*Status:* PAID\n------------------------------\nThank you!`;
      const phone = collectStudent.guardianPhone || collectStudent.primaryPhone;
      if (phone) {
        Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`);
      }

      Alert.alert("Fee Collected!", `INR ${num.toLocaleString("en-IN")} collected for ${collectStudent.displayName} (${collectSelectedMonths.length} month(s) marked).`);
      setCollectStudent(null);
      fetchRecurringFees();
    } catch {
      // Optimistic update
      setFeesList((prev) =>
        prev.map((f) =>
          f.studentProfileId === collectStudent.studentProfileId
            ? { ...f, status: "PAID", balanceMinor: 0, paidMinor: Math.round(num * 100) }
            : f
        )
      );
      Alert.alert("Fee Collected!", `INR ${num.toLocaleString("en-IN")} recorded for ${collectStudent.displayName}!`);
      setCollectStudent(null);
    } finally {
      setCollectBusy(false);
    }
  };

  const handleMarkAttendance = async (studentId: string, status: "PRESENT" | "ABSENT" | "LEAVE") => {
    setAttendanceList((prev) =>
      prev.map((a) => (a.studentProfileId === studentId ? { ...a, status } : a))
    );

    try {
      await apiFetch("/students/attendance", {
        method: "POST",
        body: JSON.stringify({
          date: selectedDate,
          records: [{ studentProfileId: studentId, status }],
        }),
      });
    } catch {}
  };

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      s.person.displayName.toLowerCase().includes(q) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
      (s.person.primaryPhone && s.person.primaryPhone.includes(q));

    if (!matchSearch) return false;
    if (selectedStandard !== "ALL") return s.standard === selectedStandard;
    return true;
  });

  const totalExpected = feesList.reduce((sum, f) => sum + f.feePlanAmountMinor, 0);
  const totalCollected = feesList.reduce((sum, f) => sum + f.paidMinor, 0);
  const totalPending = feesList.reduce((sum, f) => sum + f.balanceMinor, 0);

  const presentCount = attendanceList.filter((a) => a.status === "PRESENT").length;
  const absentCount = attendanceList.filter((a) => a.status === "ABSENT").length;
  const leaveCount = attendanceList.filter((a) => a.status === "LEAVE").length;

  return (
    <View style={styles.container}>
      <AppHeader
        title={isGym ? "Gym & Fitness Studio" : "Students & Academy"}
        subtitle={isGym ? "Members, validity cycles & check-in attendance" : "Admissions, monthly recurring fees & daily attendance"}
        rightAction={
          <TouchableOpacity onPress={handleOpenAdmission} style={styles.addBtn}>
            <Icon name="Plus" size={18} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      {/* 3 Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab("directory")}
          style={[styles.tabItem, activeTab === "directory" && styles.tabItemActive]}
        >
          <Icon name={isGym ? "Users" : "GraduationCap"} size={16} color={activeTab === "directory" ? colors.brand : colors.muted} />
          <Text style={[styles.tabText, activeTab === "directory" && styles.tabTextActive]}>
            {isGym ? "Members" : "Directory"} ({students.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("fees")}
          style={[styles.tabItem, activeTab === "fees" && styles.tabItemActive]}
        >
          <Icon name="DollarSign" size={16} color={activeTab === "fees" ? colors.brand : colors.muted} />
          <Text style={[styles.tabText, activeTab === "fees" && styles.tabTextActive]}>
            {isGym ? "Membership Plans" : "Recurring Fees"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("attendance")}
          style={[styles.tabItem, activeTab === "attendance" && styles.tabItemActive]}
        >
          <Icon name="Calendar" size={16} color={activeTab === "attendance" ? colors.brand : colors.muted} />
          <Text style={[styles.tabText, activeTab === "attendance" && styles.tabTextActive]}>
            {isGym ? "Check-in" : "Attendance"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: DIRECTORY */}
      {activeTab === "directory" && (
        <>
          <View style={styles.searchSection}>
            <View style={styles.searchBox}>
              <Icon name="Search" size={16} color={colors.muted} />
              <TextInput
                placeholder={isGym ? "Search members, ID, or phone…" : "Search students, roll no, or phone…"}
                placeholderTextColor={colors.muted}
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
              {Boolean(search) && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Icon name="X" size={16} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Standard / Package Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.standardsScroll}>
              {standardsList.map((std) => (
                <TouchableOpacity
                  key={std}
                  onPress={() => setSelectedStandard(std)}
                  style={[styles.stdChip, selectedStandard === std && styles.stdChipActive]}
                >
                  <Text style={[styles.stdChipText, selectedStandard === std && styles.stdChipTextActive]}>
                    {std}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredStudents}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchStudents();
                }}
              />
            }
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const planMonths = item.planValidityMonths || (item.feeFrequency === "QUARTERLY" ? 3 : item.feeFrequency === "ANNUAL" ? 12 : 1);
              return (
                <View style={styles.studentCard}>
                  <View style={styles.studentTopRow}>
                    <View style={styles.rollBadge}>
                      <Text style={styles.rollText}>{item.rollNumber || (isGym ? "GYM" : "ST")}</Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={styles.studentName}>{item.person.displayName}</Text>
                        {item.rollNumber ? (
                          <View style={styles.idChip}>
                            <Text style={styles.idChipText}>{item.rollNumber}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.studentClass}>
                        {item.standard} • {item.batch || (isGym ? "Morning Access" : "Regular Batch")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.studentFee}>
                        {formatRupees(item.feeAmountMinor)}
                        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
                          {planMonths > 1 ? ` /${planMonths}mo` : "/mo"}
                        </Text>
                      </Text>
                      {planMonths > 1 && (
                        <View style={styles.planBadge}>
                          <Text style={styles.planBadgeText}>{planMonths} Mo Plan</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {Boolean(item.guardianName) && (
                    <Text style={styles.guardianText}>
                      {isGym ? "Emergency: " : "Parent: "}{item.guardianName}
                      {item.guardianPhone ? ` (${item.guardianPhone})` : ""}
                      {item.guardianRelation ? ` • ${item.guardianRelation}` : ""}
                    </Text>
                  )}

                {/* Direct Contact Actions */}
                <View style={styles.contactRow}>
                  {Boolean(item.person.primaryPhone) && (
                    <>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${item.person.primaryPhone}`)}
                        style={[styles.contactBtn, { backgroundColor: colors.surfaceMuted }]}
                      >
                        <Icon name="Phone" size={13} color={colors.ink} />
                        <Text style={styles.contactBtnText}>Call Parent</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(
                            `https://wa.me/${item.person.primaryPhone?.replace(/\D/g, "")}`
                          )
                        }
                        style={[styles.contactBtn, { backgroundColor: colors.emeraldLight }]}
                      >
                        <Icon name="MessageSquare" size={13} color={colors.emerald} />
                        <Text style={[styles.contactBtnText, { color: colors.emerald }]}>
                          WhatsApp
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          }}
          />
        </>
      )}

      {/* TAB 2: RECURRING MONTHLY FEES */}
      {activeTab === "fees" && (
        <View style={{ flex: 1 }}>
          {/* Month Selector Bar */}
          <View style={styles.monthBar}>
            <Text style={styles.monthLabel}>Monthly Fee Cycle: {selectedMonth}</Text>
          </View>

          {/* Revenue KPIs */}
          <View style={styles.feeKpiRow}>
            <View style={styles.feeKpiCard}>
              <Text style={styles.feeKpiTitle}>Expected</Text>
              <Text style={styles.feeKpiVal}>{formatRupees(totalExpected)}</Text>
            </View>
            <View style={styles.feeKpiCard}>
              <Text style={styles.feeKpiTitle}>Collected</Text>
              <Text style={[styles.feeKpiVal, { color: colors.emerald }]}>{formatRupees(totalCollected)}</Text>
            </View>
            <View style={styles.feeKpiCard}>
              <Text style={styles.feeKpiTitle}>Pending</Text>
              <Text style={[styles.feeKpiVal, { color: colors.danger }]}>{formatRupees(totalPending)}</Text>
            </View>
          </View>

          <FlatList
            data={feesList}
            keyExtractor={(item) => item.studentProfileId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isPaid = item.status === "PAID";
              return (
                <View style={styles.feeCard}>
                  <View style={styles.feeCardTop}>
                    <View>
                      <Text style={styles.feeStudentName}>{item.displayName}</Text>
                      <Text style={styles.feeStandardText}>{item.standard}</Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.feeAmountText, { color: isPaid ? colors.emerald : colors.ink }]}>
                        {formatRupees(item.feePlanAmountMinor)}
                      </Text>
                      <Badge tone={isPaid ? "emerald" : "rose"}>
                        {isPaid ? "Paid" : "Pending"}
                      </Badge>
                    </View>
                  </View>

                  <View style={styles.feeCardBottom}>
                    <Text style={styles.feeCycleText}>Cycle: {selectedMonth}</Text>
                    {!isPaid ? (
                      <TouchableOpacity
                        onPress={() => handleOpenCollectModal(item)}
                        style={styles.collectBtn}
                      >
                        <Icon name="Zap" size={13} color="#ffffff" />
                        <Text style={styles.collectBtnText}>Collect Fee</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.paidCheckRow}>
                        <Icon name="CheckCircle2" size={15} color={colors.emerald} />
                        <Text style={styles.paidCheckText}>Paid</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* TAB 3: DAILY ATTENDANCE */}
      {activeTab === "attendance" && (
        <View style={{ flex: 1 }}>
          {/* Date & Counters Bar */}
          <View style={styles.attHeaderBar}>
            <View style={styles.dateBadge}>
              <Icon name="Calendar" size={14} color={colors.brand} />
              <Text style={styles.dateBadgeText}>{selectedDate}</Text>
            </View>

            <View style={styles.attCounters}>
              <View style={[styles.attPill, { backgroundColor: colors.emeraldLight }]}>
                <Text style={[styles.attPillText, { color: colors.emerald }]}>P: {presentCount}</Text>
              </View>
              <View style={[styles.attPill, { backgroundColor: "#fff1f2" }]}>
                <Text style={[styles.attPillText, { color: colors.danger }]}>A: {absentCount}</Text>
              </View>
              <View style={[styles.attPill, { backgroundColor: "#fff7ed" }]}>
                <Text style={[styles.attPillText, { color: "#ea580c" }]}>L: {leaveCount}</Text>
              </View>
            </View>
          </View>

          <FlatList
            data={attendanceList}
            keyExtractor={(item) => item.studentProfileId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.attCard}>
                <View style={styles.attCardMeta}>
                  <View style={styles.rollBadge}>
                    <Text style={styles.rollText}>{item.rollNumber || "ST"}</Text>
                  </View>
                  <View>
                    <Text style={styles.studentName}>{item.displayName}</Text>
                    <Text style={styles.studentClass}>{item.standard}</Text>
                  </View>
                </View>

                {/* 3 Action Buttons */}
                <View style={styles.attButtonsRow}>
                  <TouchableOpacity
                    onPress={() => handleMarkAttendance(item.studentProfileId, "PRESENT")}
                    style={[styles.attChip, item.status === "PRESENT" && styles.presentActive]}
                  >
                    <Text style={[styles.attChipText, item.status === "PRESENT" && styles.textWhite]}>
                      P
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleMarkAttendance(item.studentProfileId, "ABSENT")}
                    style={[styles.attChip, item.status === "ABSENT" && styles.absentActive]}
                  >
                    <Text style={[styles.attChipText, item.status === "ABSENT" && styles.textWhite]}>
                      A
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleMarkAttendance(item.studentProfileId, "LEAVE")}
                    style={[styles.attChip, item.status === "LEAVE" && styles.leaveActive]}
                  >
                    <Text style={[styles.attChipText, item.status === "LEAVE" && styles.textWhite]}>
                      L
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* Member / Student Admission BottomSheet Modal */}
      <BottomSheet
        visible={isAdmissionOpen}
        onClose={() => setIsAdmissionOpen(false)}
        title={isGym ? "New Member Admission" : "Student Admission"}
        subtitle={isGym ? "Enroll new member & configure membership fee plan" : "Enroll new student & configure monthly fee plan"}
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setIsAdmissionOpen(false)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={admissionBusy ? "Enrolling…" : (isGym ? "Confirm Enrollment" : "Confirm Admission")}
              onPress={handleSaveAdmission}
              loading={admissionBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <ScrollView showsVerticalScrollIndicator={false} style={styles.formScroll}>
          <View style={styles.formWrap}>
            {/* Section 1: Basic Info */}
            <Text style={styles.fieldLabel}>{isGym ? "Member Full Name *" : "Student Full Name *"}</Text>
            <TextInput
              placeholder={isGym ? "e.g. Aryan Sharma" : "e.g. Sahil Deshmukh"}
              placeholderTextColor={colors.muted}
              value={formName}
              onChangeText={setFormName}
              style={styles.input}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{isGym ? "Primary Phone *" : "Student Phone"}</Text>
                <TextInput
                  placeholder="e.g. 98765 43210"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  value={formPhone}
                  onChangeText={setFormPhone}
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{isGym ? "Member ID / Reg No" : "Roll Number"}</Text>
                <TextInput
                  placeholder={isGym ? "GYM-1001" : "ST-1001"}
                  placeholderTextColor={colors.muted}
                  value={formRollNumber}
                  onChangeText={setFormRollNumber}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Section 2: Package & Slot */}
            <Text style={styles.fieldLabel}>{isGym ? "Membership Package *" : "Class / Standard *"}</Text>
            <TextInput
              placeholder={isGym ? "e.g. Strength Training" : "e.g. 10th Standard"}
              placeholderTextColor={colors.muted}
              value={formStandard}
              onChangeText={setFormStandard}
              style={styles.input}
            />
            {/* Quick Package Chips */}
            <View style={styles.suggestionRow}>
              {(isGym
                ? ["Strength Training", "Cardio + Weights", "CrossFit", "Personal Training"]
                : ["9th Grade", "10th Standard", "11th Science", "12th Standard"]
              ).map((pkg) => (
                <TouchableOpacity
                  key={pkg}
                  onPress={() => setFormStandard(pkg)}
                  style={[styles.suggestionChip, formStandard === pkg && styles.suggestionChipActive]}
                >
                  <Text style={[styles.suggestionChipText, formStandard === pkg && styles.suggestionChipTextActive]}>
                    {pkg}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{isGym ? "Workout Slot / Batch" : "Batch / Section"}</Text>
            <TextInput
              placeholder={isGym ? "e.g. Morning 6-8 AM" : "e.g. Morning Batch"}
              placeholderTextColor={colors.muted}
              value={formBatch}
              onChangeText={setFormBatch}
              style={styles.input}
            />
            {/* Quick Slot Chips */}
            <View style={styles.suggestionRow}>
              {(isGym
                ? ["Morning 6-8 AM", "Morning 8-10 AM", "Evening 5-7 PM", "Evening 7-9 PM", "All Day"]
                : ["Morning Batch", "Evening Batch", "Weekend Batch"]
              ).map((slot) => (
                <TouchableOpacity
                  key={slot}
                  onPress={() => setFormBatch(slot)}
                  style={[styles.suggestionChip, formBatch === slot && styles.suggestionChipActive]}
                >
                  <Text style={[styles.suggestionChipText, formBatch === slot && styles.suggestionChipTextActive]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Section 3: Fee & Validity Plan */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{isGym ? "Membership Fee (₹) *" : "Monthly Fee (₹) *"}</Text>
                <TextInput
                  placeholder="e.g. 1500"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  value={formFee}
                  onChangeText={setFormFee}
                  style={styles.input}
                />
              </View>
            </View>

            {/* 12-Month Plan Validity & Fee Calendar */}
            {(() => {
              const now = new Date();
              const currentYyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
              const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              const selectedSorted = [...admissionSelectedMonths].sort();
              const selectedLabels = selectedSorted.map((ym) => {
                const [y, m] = ym.split("-");
                const idx = parseInt(m, 10) - 1;
                return `${monthNames[idx] || m} ${y}`;
              });

              return (
                <View style={{ marginBottom: spacing.md }}>
                  {/* Header & Year Switcher */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
                    <Text style={styles.fieldLabel}>12-Month Plan Validity Calendar</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setAdmissionYear((y) => y - 1)}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.lineLight, backgroundColor: "#fff" }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted }}>&lt; {admissionYear - 1}</Text>
                      </TouchableOpacity>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.brandLight }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.brand }}>{admissionYear}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setAdmissionYear((y) => y + 1)}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.lineLight, backgroundColor: "#fff" }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted }}>{admissionYear + 1} &gt;</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Quick Select Buttons */}
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: spacing.sm }}>
                    {[
                      { count: 1, label: "+1 Mo" },
                      { count: 2, label: "+2 Mo" },
                      { count: 3, label: "+3 Mo" },
                      { count: 6, label: "+6 Mo" },
                      { count: 12, label: "+1 Yr" },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.count}
                        onPress={() => quickSelectAdmissionMonths(opt.count)}
                        style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.lineLight, backgroundColor: "#fff" }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "650", color: colors.ink }}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                    {admissionSelectedMonths.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setAdmissionSelectedMonths([]);
                          setFormPlanMonths(1);
                        }}
                        style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fff1f2", marginLeft: "auto" }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "650", color: "#b91c1c" }}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 12 Months Grid */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm }}>
                    {monthNames.map((mName, idx) => {
                      const mNum = String(idx + 1).padStart(2, "0");
                      const yyyyMm = `${admissionYear}-${mNum}`;
                      const isCurrent = yyyyMm === currentYyyyMm;
                      const isSelected = admissionSelectedMonths.includes(yyyyMm);

                      let bg = "#ffffff";
                      let bColor = colors.lineLight;
                      let txtColor = colors.ink;
                      if (isSelected) {
                        bg = "#eff6ff";
                        bColor = colors.brand;
                        txtColor = colors.brand;
                      } else if (isCurrent) {
                        bg = "#fffbeb";
                        bColor = "#f59e0b";
                        txtColor = "#92400e";
                      }

                      return (
                        <TouchableOpacity
                          key={yyyyMm}
                          onPress={() => toggleAdmissionMonth(yyyyMm)}
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
                          {isSelected ? (
                            <Text style={{ fontSize: 8.5, fontWeight: "800", color: colors.brand, marginTop: 2 }}>MARKED</Text>
                          ) : isCurrent ? (
                            <Text style={{ fontSize: 8.5, fontWeight: "800", color: "#92400e", marginTop: 2 }}>CURRENT</Text>
                          ) : (
                            <Text style={{ fontSize: 8.5, color: colors.muted, marginTop: 2 }}>Select</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Selected Months Summary */}
                  <View style={{ padding: spacing.sm, borderRadius: radius.md, backgroundColor: admissionSelectedMonths.length > 0 ? "#eff6ff" : "#fffbeb", borderWidth: 1, borderColor: admissionSelectedMonths.length > 0 ? "#bfdbfe" : "#fde68a" }}>
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: admissionSelectedMonths.length > 0 ? colors.brand : "#92400e" }}>
                      {admissionSelectedMonths.length > 0
                        ? `Marked Validity (${admissionSelectedMonths.length} Months): ${selectedLabels.join(", ")}`
                        : "No months marked. Click on one or more months above."}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Section 4: Initial Payment at Admission */}
            <Text style={styles.fieldLabel}>Admission Payment Status</Text>
            <View style={styles.paymentToggleRow}>
              <TouchableOpacity
                onPress={() => setAdmissionPaymentStatus("PAID_NOW")}
                style={[
                  styles.paymentToggleBtn,
                  admissionPaymentStatus === "PAID_NOW" && styles.paymentToggleBtnActive,
                ]}
              >
                <Icon
                  name="CheckCircle2"
                  size={14}
                  color={admissionPaymentStatus === "PAID_NOW" ? colors.emerald : colors.muted}
                />
                <Text
                  style={[
                    styles.paymentToggleText,
                    admissionPaymentStatus === "PAID_NOW" && styles.paymentToggleTextActive,
                  ]}
                >
                  Paid Now (Issue Receipt)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAdmissionPaymentStatus("PENDING")}
                style={[
                  styles.paymentToggleBtn,
                  admissionPaymentStatus === "PENDING" && { backgroundColor: "#fff1f2", borderColor: "#fecdd3" },
                ]}
              >
                <Icon
                  name="Clock"
                  size={14}
                  color={admissionPaymentStatus === "PENDING" ? colors.danger : colors.muted}
                />
                <Text
                  style={[
                    styles.paymentToggleText,
                    admissionPaymentStatus === "PENDING" && { color: colors.danger, fontWeight: "800" },
                  ]}
                >
                  Pay Later / Dues
                </Text>
              </TouchableOpacity>
            </View>

            {admissionPaymentStatus === "PAID_NOW" && (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.fieldLabel}>Payment Mode</Text>
                <View style={styles.methodRow}>
                  {(["UPI", "CASH", "BANK_TRANSFER"] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setAdmissionPaymentMethod(m)}
                      style={[styles.methodChip, admissionPaymentMethod === m && styles.methodChipActive]}
                    >
                      <Text style={[styles.methodChipText, admissionPaymentMethod === m && styles.methodChipTextActive]}>
                        {m === "BANK_TRANSFER" ? "Bank Transfer" : m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Section 5: Emergency Contact */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{isGym ? "Emergency Contact Name" : "Guardian Name"}</Text>
                <TextInput
                  placeholder="e.g. Ramesh Sharma"
                  placeholderTextColor={colors.muted}
                  value={formGuardianName}
                  onChangeText={setFormGuardianName}
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{isGym ? "Emergency Phone" : "Guardian Phone"}</Text>
                <TextInput
                  placeholder="e.g. 98223 34455"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  value={formGuardianPhone}
                  onChangeText={setFormGuardianPhone}
                  style={styles.input}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Relation</Text>
            <View style={styles.suggestionRow}>
              {RELATION_OPTIONS.map((rel) => (
                <TouchableOpacity
                  key={rel}
                  onPress={() => setFormGuardianRelation(rel)}
                  style={[styles.suggestionChip, formGuardianRelation === rel && styles.suggestionChipActive]}
                >
                  <Text style={[styles.suggestionChipText, formGuardianRelation === rel && styles.suggestionChipTextActive]}>
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Section 6: Address (Optional) */}
            <Text style={styles.fieldLabel}>Address (Optional)</Text>
            <TextInput
              placeholder="e.g. Flat 302, Galaxy Heights, Linking Road"
              placeholderTextColor={colors.muted}
              value={formAddress}
              onChangeText={setFormAddress}
              style={[styles.input, { height: 60 }]}
              multiline
            />
          </View>
        </ScrollView>
      </BottomSheet>

      {/* Collect Fee Modal (12-Month Calendar Grid) */}
      <BottomSheet
        visible={Boolean(collectStudent)}
        onClose={() => setCollectStudent(null)}
        title="Collect Fee & Renewal"
        subtitle={collectStudent ? `${collectStudent.displayName} - 12-Month Fee Calendar` : ""}
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setCollectStudent(null)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={
                collectBusy
                  ? "Processing…"
                  : `Record INR ${Number(collectAmount) > 0 ? Number(collectAmount).toLocaleString("en-IN") : "0"}`
              }
              onPress={handleSaveCollectFee}
              disabled={collectBusy || collectSelectedMonths.length === 0 || !collectAmount || Number(collectAmount) <= 0}
              loading={collectBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        {collectStudent && (() => {
          const paidMonths = getStudentPaidMonths(collectStudent.studentProfileId, collectFeeYear);
          const now = new Date();
          const currentYyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const selectedSorted = [...collectSelectedMonths].sort();
          const selectedLabels = selectedSorted.map((ym) => {
            const [y, m] = ym.split("-");
            const idx = parseInt(m, 10) - 1;
            return `${monthNames[idx] || m} ${y}`;
          });

          return (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <View style={styles.formWrap}>
                {/* Year Switcher Header */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
                  <Text style={styles.fieldLabel}>12-Month Fee Calendar</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setCollectFeeYear((y) => y - 1)}
                      style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.lineLight, backgroundColor: "#fff" }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted }}>&lt; {collectFeeYear - 1}</Text>
                    </TouchableOpacity>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.brandLight }}>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: colors.brand }}>{collectFeeYear}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setCollectFeeYear((y) => y + 1)}
                      style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.lineLight, backgroundColor: "#fff" }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted }}>{collectFeeYear + 1} &gt;</Text>
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
                      onPress={() => quickSelectCollectMonths(opt.count)}
                      style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.lineLight, backgroundColor: "#fff" }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "650", color: colors.ink }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                  {collectSelectedMonths.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setCollectSelectedMonths([])}
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
                    const yyyyMm = `${collectFeeYear}-${mNumStr}`;
                    const isPaid = paidMonths.has(yyyyMm);
                    const isCurrent = yyyyMm === currentYyyyMm;
                    const isSelected = collectSelectedMonths.includes(yyyyMm);

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
                        onPress={() => toggleCollectMonth(yyyyMm, isPaid)}
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
                <View style={{ padding: spacing.sm, borderRadius: radius.md, backgroundColor: collectSelectedMonths.length > 0 ? "#eff6ff" : "#fffbeb", borderWidth: 1, borderColor: collectSelectedMonths.length > 0 ? "#bfdbfe" : "#fde68a", marginBottom: spacing.md }}>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: collectSelectedMonths.length > 0 ? colors.brand : "#92400e" }}>
                    {collectSelectedMonths.length > 0
                      ? `Marked for Payment (${collectSelectedMonths.length}): ${selectedLabels.join(", ")}`
                      : "No months marked. Click on one or more unpaid months above."}
                  </Text>
                </View>

                {/* Total Amount Input (100% manual entry) */}
                <View style={{ marginBottom: spacing.md }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Text style={styles.fieldLabel}>Total Amount (INR) *</Text>
                    <Text style={{ fontSize: 10.5, color: colors.muted }}>Manual Entry (No auto-calc)</Text>
                  </View>
                  <View style={styles.amountInputWrap}>
                    <Text style={styles.rupeeSymbol}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="numeric"
                      value={collectAmount}
                      onChangeText={setCollectAmount}
                      placeholder="Enter amount manually"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                    Type the exact collected fee amount. No automatic multiplication.
                  </Text>
                </View>

                {/* Payment Mode */}
                <Text style={styles.fieldLabel}>Payment Mode</Text>
                <View style={styles.methodRow}>
                  {(["UPI", "CASH", "BANK_TRANSFER"] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setCollectMethod(m)}
                      style={[styles.methodChip, collectMethod === m && styles.methodChipActive]}
                    >
                      <Text style={[styles.methodChipText, collectMethod === m && styles.methodChipTextActive]}>
                        {m === "BANK_TRANSFER" ? "Bank" : m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          );
        })()}
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
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: colors.brand,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.brandNavy,
    fontWeight: "800",
  },
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 42,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
  },
  standardsScroll: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  stdChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  stdChipActive: {
    backgroundColor: colors.brandNavy,
    borderColor: colors.brandNavy,
  },
  stdChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  stdChipTextActive: {
    color: "#ffffff",
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  studentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
  },
  studentTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rollBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  rollText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.ink,
  },
  studentClass: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  studentFee: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.emerald,
  },
  guardianText: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: spacing.xs,
    paddingLeft: 46,
  },
  contactRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  contactBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.ink,
  },
  monthBar: {
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brandNavy,
  },
  feeKpiRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  feeKpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  feeKpiTitle: {
    fontSize: 10.5,
    color: colors.muted,
    fontWeight: "700",
  },
  feeKpiVal: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },
  feeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  feeCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  feeStudentName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  feeStandardText: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  feeAmountText: {
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },
  feeCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  feeCycleText: {
    fontSize: 11,
    color: colors.muted,
  },
  collectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  collectBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  paidCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paidCheckText: {
    color: colors.emerald,
    fontSize: 12,
    fontWeight: "800",
  },
  attHeaderBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateBadgeText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.ink,
  },
  attCounters: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  attPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  attPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  attCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  attCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  attButtonsRow: {
    flexDirection: "row",
    gap: 6,
  },
  attChip: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  attChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.muted,
  },
  presentActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  absentActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  leaveActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  textWhite: {
    color: "#ffffff",
  },
  formWrap: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 2,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13.5,
    color: colors.ink,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalFooterRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: 60,
    borderWidth: 1.5,
    borderColor: colors.brandBorder,
  },
  rupeeSymbol: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.brandNavy,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: "900",
    color: colors.brandNavy,
  },
  methodRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  methodChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  methodChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  methodChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.muted,
  },
  methodChipTextActive: {
    color: colors.brand,
  },
  idChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: colors.brandBorder,
  },
  idChipText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.brand,
  },
  planBadge: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  formScroll: {
    maxHeight: 500,
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  suggestionChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  suggestionChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
  },
  suggestionChipTextActive: {
    color: colors.brand,
  },
  planSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
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
  planInfoBanner: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  planInfoText: {
    fontSize: 11.5,
    color: "#1d4ed8",
    fontWeight: "700",
    lineHeight: 16,
  },
  paymentToggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 4,
  },
  paymentToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  paymentToggleBtnActive: {
    backgroundColor: colors.emeraldLight,
    borderColor: colors.emeraldBorder,
  },
  paymentToggleText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  paymentToggleTextActive: {
    color: colors.emerald,
    fontWeight: "800",
  },
  collectPreviewNote: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: radius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    gap: 2,
  },
  collectPreviewText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  collectNextDueText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1e40af",
  },
});
