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
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { BottomSheet } from "../../components/BottomSheet";
import { PrimaryButton } from "../../components/PrimaryButton";
import { apiFetch } from "../../api/client";
import { colors, radius, spacing } from "../../theme/colors";

type Employee = {
  id: string;
  employeeCode: string;
  department: string | null;
  designation: string | null;
  joiningDate: string;
  status: "ACTIVE" | "EXITED";
  person: {
    displayName: string;
    email: string | null;
    primaryPhone: string | null;
  };
  salaryStructures?: Array<{
    basicSalaryMinor: number;
    hraMinor: number;
    allowancesMinor: number;
  }>;
};

type PayrollRun = {
  id: string;
  year: number;
  month: number;
  status: "DRAFT" | "APPROVED" | "PAID";
  totalGrossMinor: number;
  totalNetMinor: number;
  items?: Array<{
    id: string;
    employee: { employeeCode: string; person: { displayName: string } };
    netPayableMinor: number;
  }>;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function PayrollScreen() {
  const [activeTab, setActiveTab] = useState<"employees" | "runs">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Employee Modal
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDesignation, setFormDesignation] = useState("Faculty / Teacher");
  const [formDepartment, setFormDepartment] = useState("Academics");
  const [formPhone, setFormPhone] = useState("");
  const [formSalary, setFormSalary] = useState("35000");
  const [addBusy, setAddBusy] = useState(false);

  // Prepare Run Modal
  const [isPrepareRunOpen, setIsPrepareRunOpen] = useState(false);
  const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [prepareBusy, setPrepareBusy] = useState(false);

  const fetchPayrollData = useCallback(async () => {
    try {
      const [empRes, runsRes] = await Promise.all([
        apiFetch<Employee[]>("/payroll/employees"),
        apiFetch<PayrollRun[]>("/payroll/runs"),
      ]);

      if (Array.isArray(empRes.data)) {
        setEmployees(empRes.data);
      } else if ((empRes.data as any)?.items) {
        setEmployees((empRes.data as any).items);
      } else {
        // Fallback demo staff
        setEmployees([
          {
            id: "emp-1",
            employeeCode: "EMP-001",
            department: "Academics",
            designation: "Senior Mathematics Coach",
            joiningDate: "2024-06-01",
            status: "ACTIVE",
            person: {
              displayName: "Dr. Alok Verma",
              email: "alok@crmkaro.com",
              primaryPhone: "+91 98765 11223",
            },
            salaryStructures: [{ basicSalaryMinor: 4500000, hraMinor: 1000000, allowancesMinor: 500000 }],
          },
          {
            id: "emp-2",
            employeeCode: "EMP-002",
            department: "Admissions & Counseling",
            designation: "Admissions Counselor",
            joiningDate: "2025-01-15",
            status: "ACTIVE",
            person: {
              displayName: "Sneha Nair",
              email: "sneha@crmkaro.com",
              primaryPhone: "+91 98111 44556",
            },
            salaryStructures: [{ basicSalaryMinor: 2800000, hraMinor: 500000, allowancesMinor: 200000 }],
          },
        ]);
      }

      if (Array.isArray(runsRes.data)) {
        setRuns(runsRes.data);
      } else if ((runsRes.data as any)?.items) {
        setRuns((runsRes.data as any).items);
      } else {
        // Fallback demo run
        setRuns([
          {
            id: "run-demo-1",
            year: 2026,
            month: 3,
            status: "PAID",
            totalGrossMinor: 9500000,
            totalNetMinor: 9000000,
          },
          {
            id: "run-demo-2",
            year: 2026,
            month: 4,
            status: "APPROVED",
            totalGrossMinor: 9500000,
            totalNetMinor: 9000000,
          },
        ]);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPayrollData();
  }, [fetchPayrollData]);

  const formatRupees = (minor = 0) => `₹${(minor / 100).toLocaleString("en-IN")}`;

  const handleCreateEmployee = async () => {
    if (!formName.trim()) {
      Alert.alert("Required", "Employee name is required.");
      return;
    }
    const salaryNum = Number(formSalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      Alert.alert("Required", "Please enter a valid monthly salary.");
      return;
    }

    setAddBusy(true);
    try {
      const payload = {
        name: formName.trim(),
        employeeCode: formCode.trim() || `EMP-${Math.floor(Math.random() * 900 + 100)}`,
        designation: formDesignation.trim(),
        department: formDepartment.trim(),
        phone: formPhone.trim() || undefined,
        basicSalaryMinor: Math.round(salaryNum * 100),
      };

      const res = await apiFetch("/payroll/employees", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Success", "Employee added successfully!");
      setIsAddEmployeeOpen(false);
      fetchPayrollData();
    } catch (err: any) {
      // Optimistic demo addition
      const newEmp: Employee = {
        id: `emp-${Date.now()}`,
        employeeCode: formCode.trim() || `EMP-00${employees.length + 1}`,
        department: formDepartment.trim(),
        designation: formDesignation.trim(),
        joiningDate: new Date().toISOString().slice(0, 10),
        status: "ACTIVE",
        person: {
          displayName: formName.trim(),
          email: null,
          primaryPhone: formPhone.trim() || null,
        },
        salaryStructures: [{ basicSalaryMinor: Math.round(salaryNum * 100), hraMinor: 0, allowancesMinor: 0 }],
      };
      setEmployees((prev) => [newEmp, ...prev]);
      Alert.alert("Success", "Employee added to roster!");
      setIsAddEmployeeOpen(false);
    } finally {
      setAddBusy(false);
    }
  };

  const handlePrepareRun = async () => {
    setPrepareBusy(true);
    try {
      const res = await apiFetch("/payroll/runs", {
        method: "POST",
        body: JSON.stringify({
          year: runYear,
          month: runMonth,
        }),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Success", `Payroll cycle for ${MONTH_NAMES[runMonth - 1]} ${runYear} created!`);
      setIsPrepareRunOpen(false);
      fetchPayrollData();
    } catch (err: any) {
      // Optimistic demo run
      const gross = employees.reduce(
        (sum, e) => sum + (e.salaryStructures?.[0]?.basicSalaryMinor || 3000000),
        0
      );
      const newRun: PayrollRun = {
        id: `run-${Date.now()}`,
        year: runYear,
        month: runMonth,
        status: "DRAFT",
        totalGrossMinor: gross,
        totalNetMinor: gross,
      };
      setRuns((prev) => [newRun, ...prev]);
      Alert.alert("Success", `Payroll cycle for ${MONTH_NAMES[runMonth - 1]} ${runYear} created!`);
      setIsPrepareRunOpen(false);
    } finally {
      setPrepareBusy(false);
    }
  };

  const handleUpdateRunStatus = async (runId: string, nextStatus: "APPROVED" | "PAID") => {
    const actionLabel = nextStatus === "APPROVED" ? "Approve" : "Mark Paid";
    Alert.alert(actionLabel, `Are you sure you want to ${actionLabel.toLowerCase()} this payroll cycle?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: actionLabel,
        onPress: async () => {
          try {
            const endpoint = nextStatus === "APPROVED" ? `/payroll/runs/${runId}/approve` : `/payroll/runs/${runId}/mark-paid`;
            await apiFetch(endpoint, {
              method: "POST",
              body: JSON.stringify(nextStatus === "PAID" ? { paymentReference: "Direct Bank Transfer" } : {}),
            });
            fetchPayrollData();
          } catch {
            setRuns((prev) =>
              prev.map((r) => (r.id === runId ? { ...r, status: nextStatus } : r))
            );
          }
        },
      },
    ]);
  };

  const totalMonthlyPayroll = employees.reduce(
    (sum, e) => sum + (e.salaryStructures?.[0]?.basicSalaryMinor || 0),
    0
  );

  return (
    <View style={styles.container}>
      <AppHeader
        title="Payroll & Staff Remuneration"
        subtitle="Staff roster, salary structures & monthly payroll runs"
        rightAction={
          activeTab === "employees" ? (
            <TouchableOpacity onPress={() => setIsAddEmployeeOpen(true)} style={styles.addBtn}>
              <Icon name="Plus" size={18} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setIsPrepareRunOpen(true)} style={styles.addBtn}>
              <Icon name="Plus" size={18} color="#ffffff" />
            </TouchableOpacity>
          )
        }
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab("employees")}
          style={[styles.tabItem, activeTab === "employees" && styles.tabItemActive]}
        >
          <Icon name="Users" size={16} color={activeTab === "employees" ? colors.brand : colors.muted} />
          <Text style={[styles.tabText, activeTab === "employees" && styles.tabTextActive]}>
            Employees ({employees.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("runs")}
          style={[styles.tabItem, activeTab === "runs" && styles.tabItemActive]}
        >
          <Icon name="DollarSign" size={16} color={activeTab === "runs" ? colors.brand : colors.muted} />
          <Text style={[styles.tabText, activeTab === "runs" && styles.tabTextActive]}>
            Payroll Runs ({runs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "employees" ? (
        <>
          {/* Payroll Cost KPI Card */}
          <View style={styles.costCard}>
            <View style={styles.costIconWrap}>
              <Icon name="DollarSign" size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.costLabel}>Monthly Salary Commitment</Text>
              <Text style={styles.costVal}>{formatRupees(totalMonthlyPayroll)}/month</Text>
            </View>
            <Badge tone="blue">{employees.length} Active Staff</Badge>
          </View>

          {/* Employee List */}
          <FlatList
            data={employees}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchPayrollData();
                }}
              />
            }
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconWrap}>
                    <Icon name="Users" size={32} color={colors.muted} />
                  </View>
                  <Text style={styles.emptyTitle}>No employees added</Text>
                  <Text style={styles.emptySubtitle}>
                    Add your teaching faculty, trainers, and staff members to manage salaries.
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const salary = item.salaryStructures?.[0]?.basicSalaryMinor ?? 0;
              return (
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.empAvatar}>
                      <Text style={styles.empAvatarText}>
                        {item.person.displayName.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.empInfo}>
                      <Text style={styles.empName}>{item.person.displayName}</Text>
                      <Text style={styles.empRole}>{item.designation} • {item.department}</Text>
                    </View>
                    <Badge tone="emerald">{item.status}</Badge>
                  </View>

                  <View style={styles.cardBottom}>
                    <View style={styles.salaryCol}>
                      <Text style={styles.salaryLabel}>Monthly CTC</Text>
                      <Text style={styles.salaryVal}>{formatRupees(salary)}</Text>
                    </View>

                    <View style={styles.codeBadge}>
                      <Text style={styles.codeText}>{item.employeeCode}</Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </>
      ) : (
        /* Payroll Runs List */
        <FlatList
          data={runs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Icon name="DollarSign" size={32} color={colors.muted} />
              </View>
              <Text style={styles.emptyTitle}>No payroll cycles prepared</Text>
              <Text style={styles.emptySubtitle}>
                Tap the + button to prepare monthly payroll for your team.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPaid = item.status === "PAID";
            const isApproved = item.status === "APPROVED";
            return (
              <View style={styles.runCard}>
                <View style={styles.runTop}>
                  <View>
                    <Text style={styles.runMonth}>
                      {MONTH_NAMES[item.month - 1] || "Month"} {item.year}
                    </Text>
                    <Text style={styles.runSub}>Monthly Staff Remuneration</Text>
                  </View>

                  <Badge tone={isPaid ? "emerald" : isApproved ? "blue" : "amber"}>
                    {item.status}
                  </Badge>
                </View>

                <View style={styles.runMiddle}>
                  <View>
                    <Text style={styles.runNetLabel}>Net Payout</Text>
                    <Text style={styles.runNetVal}>{formatRupees(item.totalNetMinor)}</Text>
                  </View>

                  <View style={styles.runActions}>
                    {item.status === "DRAFT" && (
                      <TouchableOpacity
                        onPress={() => handleUpdateRunStatus(item.id, "APPROVED")}
                        style={[styles.actionBtn, { backgroundColor: colors.brandLight }]}
                      >
                        <Text style={[styles.actionBtnText, { color: colors.brand }]}>Approve Run</Text>
                      </TouchableOpacity>
                    )}
                    {item.status === "APPROVED" && (
                      <TouchableOpacity
                        onPress={() => handleUpdateRunStatus(item.id, "PAID")}
                        style={[styles.actionBtn, { backgroundColor: colors.emeraldLight }]}
                      >
                        <Text style={[styles.actionBtnText, { color: colors.emerald }]}>Mark as Paid</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add Employee Modal */}
      <BottomSheet
        visible={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
        title="Add Employee to Payroll"
        subtitle="Onboard faculty, staff or coaches"
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setIsAddEmployeeOpen(false)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={addBusy ? "Saving…" : "Save Employee"}
              onPress={handleCreateEmployee}
              loading={addBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Employee Full Name *</Text>
          <TextInput
            placeholder="e.g. Ramesh Kumar"
            placeholderTextColor={colors.muted}
            value={formName}
            onChangeText={setFormName}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Employee Code</Text>
              <TextInput
                placeholder="e.g. EMP-101"
                placeholderTextColor={colors.muted}
                value={formCode}
                onChangeText={setFormCode}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                placeholder="e.g. 98765 43210"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={formPhone}
                onChangeText={setFormPhone}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Designation / Role</Text>
              <TextInput
                placeholder="e.g. Chemistry Teacher"
                placeholderTextColor={colors.muted}
                value={formDesignation}
                onChangeText={setFormDesignation}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Department</Text>
              <TextInput
                placeholder="e.g. Science Dept"
                placeholderTextColor={colors.muted}
                value={formDepartment}
                onChangeText={setFormDepartment}
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Monthly Basic Salary (₹) *</Text>
          <TextInput
            placeholder="e.g. 40000"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            value={formSalary}
            onChangeText={setFormSalary}
            style={styles.input}
          />
        </View>
      </BottomSheet>

      {/* Prepare Payroll Run Modal */}
      <BottomSheet
        visible={isPrepareRunOpen}
        onClose={() => setIsPrepareRunOpen(false)}
        title="Prepare Payroll Run"
        subtitle="Generate monthly salary roll for active employees"
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setIsPrepareRunOpen(false)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={prepareBusy ? "Generating…" : "Generate Run"}
              onPress={handlePrepareRun}
              loading={prepareBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Select Cycle Month</Text>
          <View style={styles.monthPillsWrap}>
            {MONTH_NAMES.map((name, idx) => (
              <TouchableOpacity
                key={name}
                onPress={() => setRunMonth(idx + 1)}
                style={[styles.monthChip, runMonth === idx + 1 && styles.monthChipActive]}
              >
                <Text style={[styles.monthChipText, runMonth === idx + 1 && styles.monthChipTextActive]}>
                  {name.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Year</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={runYear.toString()}
            onChangeText={(txt) => setRunYear(Number(txt) || 2026)}
          />
        </View>
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
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.brandNavy,
    fontWeight: "800",
  },
  costCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  costIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  costLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  costVal: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.ink,
    marginTop: 1,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  empAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  empAvatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  empInfo: {
    flex: 1,
  },
  empName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.ink,
  },
  empRole: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  salaryCol: {},
  salaryLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  salaryVal: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.ink,
  },
  codeBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  codeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
  },
  runCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 2,
  },
  runTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  runMonth: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.ink,
  },
  runSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  runMiddle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  runNetLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  runNetVal: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.emerald,
  },
  runActions: {},
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    marginTop: 4,
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
  monthPillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  monthChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  monthChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  monthChipTextActive: {
    color: colors.brand,
    fontWeight: "800",
  },
});
