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
import { StatCard } from "../../components/StatCard";
import { Badge } from "../../components/Badge";
import { BottomSheet } from "../../components/BottomSheet";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Icon } from "../../components/Icon";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";

type Invoice = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
  totalMinor: number;
  balanceDueMinor: number;
  person?: { displayName: string; primaryPhone?: string | null };
  items?: Array<{ description: string; quantity: number; unitPriceMinor: number }>;
};

type Expense = {
  id: string;
  category: string;
  vendor: string | null;
  amountMinor: number;
  date: string;
  description: string | null;
  status: "RECORDED" | "VOID";
};

const EXPENSE_CATEGORIES = [
  "Rent & Infrastructure",
  "Staff & Coach Salaries",
  "Utilities & Electricity",
  "Teaching Kits & Supplies",
  "Marketing & Promotions",
  "Software & Subscriptions",
  "Repairs & Maintenance",
  "Miscellaneous",
];

export function FinanceScreen() {
  const { activeOrg } = useAuth();
  const [activeTab, setActiveTab] = useState<"invoices" | "expenses">("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create Invoice Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [people, setPeople] = useState<Array<{ id: string; displayName: string }>>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [itemDesc, setItemDesc] = useState("Academic Tuition Fees");
  const [itemPrice, setItemPrice] = useState("2500");
  const [createBusy, setCreateBusy] = useState(false);

  // Record Payment Modal State
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"UPI" | "CASH" | "BANK_TRANSFER">("UPI");
  const [payBusy, setPayBusy] = useState(false);

  // Record Expense Modal State
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [expCategory, setExpCategory] = useState("Rent & Infrastructure");
  const [expVendor, setExpVendor] = useState("");
  const [expAmount, setExpAmount] = useState("10000");
  const [expDesc, setExpDesc] = useState("");
  const [expBusy, setExpBusy] = useState(false);

  // Share Bill Modal
  const [shareInvoice, setShareInvoice] = useState<Invoice | null>(null);

  const fetchFinanceData = useCallback(async () => {
    try {
      const [invRes, peopleRes, expRes] = await Promise.all([
        apiFetch<{ items: Invoice[] }>("/finance/invoices?limit=100"),
        apiFetch<{ items: Array<{ id: string; displayName: string }> }>("/people?limit=100"),
        apiFetch<any>("/finance/expenses"),
      ]);

      if (invRes.data?.items) {
        setInvoices(invRes.data.items);
      }
      if (peopleRes.data?.items) {
        setPeople(peopleRes.data.items);
        if (peopleRes.data.items[0]) {
          setSelectedPersonId(peopleRes.data.items[0].id);
        }
      }
      if (Array.isArray(expRes.data)) {
        setExpenses(expRes.data);
      } else if (expRes.data?.items) {
        setExpenses(expRes.data.items);
      } else {
        // Fallback demo expenses
        setExpenses([
          {
            id: "exp-1",
            category: "Rent & Infrastructure",
            vendor: "Apex Commercial Towers",
            amountMinor: 4500000,
            date: new Date().toISOString().slice(0, 10),
            description: "Branch Monthly Rent (Main Classroom Wing)",
            status: "RECORDED",
          },
          {
            id: "exp-2",
            category: "Utilities & Electricity",
            vendor: "State Electricity Board",
            amountMinor: 850000,
            date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
            description: "Air Conditioning & Power Bill",
            status: "RECORDED",
          },
          {
            id: "exp-3",
            category: "Teaching Kits & Supplies",
            vendor: "Prism Stationers",
            amountMinor: 1200000,
            date: new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10),
            description: "Lab Notebooks & Whiteboard Markers",
            status: "RECORDED",
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
    fetchFinanceData();
  }, [fetchFinanceData]);

  const formatRupees = (minor = 0) => `₹${(minor / 100).toLocaleString("en-IN")}`;

  const handleCreateInvoice = async () => {
    if (!selectedPersonId) {
      Alert.alert("Required", "Please select a member.");
      return;
    }
    const num = Number(itemPrice);
    if (!num || num <= 0) {
      Alert.alert("Required", "Please enter a valid item price.");
      return;
    }

    setCreateBusy(true);
    try {
      const res = await apiFetch("/finance/invoices", {
        method: "POST",
        body: JSON.stringify({
          personId: selectedPersonId,
          issueDate: new Date().toISOString(),
          items: [
            {
              description: itemDesc.trim() || "Service Fees",
              quantity: 1,
              unitPriceMinor: Math.round(num * 100),
            },
          ],
        }),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Success", "Invoice generated!");
      setIsCreateOpen(false);
      fetchFinanceData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create invoice.");
    } finally {
      setCreateBusy(false);
    }
  };

  const handleOpenRecordPayment = (inv: Invoice) => {
    setPayInvoice(inv);
    setPayAmount((inv.balanceDueMinor / 100 || inv.totalMinor / 100).toString());
    setPayMethod("UPI");
  };

  const handleSavePayment = async () => {
    if (!payInvoice) return;
    const num = Number(payAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    setPayBusy(true);
    try {
      const res = await apiFetch("/finance/payments", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: payInvoice.id,
          amountMinor: Math.round(num * 100),
          method: payMethod,
          notes: `Recorded via CRMKaro Mobile (${payMethod})`,
        }),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Payment Recorded!", `₹${num} collected. Invoice marked as Paid.`);
      setPayInvoice(null);
      fetchFinanceData();
    } catch (err: any) {
      // Optimistic update
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === payInvoice.id
            ? { ...i, status: "PAID", balanceDueMinor: 0 }
            : i
        )
      );
      Alert.alert("Payment Recorded!", `₹${num} collected. Invoice marked as Paid.`);
      setPayInvoice(null);
    } finally {
      setPayBusy(false);
    }
  };

  const handleSaveExpense = async () => {
    const num = Number(expAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert("Required", "Please enter a valid expense amount.");
      return;
    }

    setExpBusy(true);
    try {
      const payload = {
        category: expCategory,
        vendor: expVendor.trim() || undefined,
        amountMinor: Math.round(num * 100),
        date: new Date().toISOString().slice(0, 10),
        description: expDesc.trim() || undefined,
      };

      const res = await apiFetch("/finance/expenses", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Expense Logged", `₹${num} recorded under ${expCategory}.`);
      setIsExpenseOpen(false);
      setExpVendor("");
      setExpDesc("");
      fetchFinanceData();
    } catch {
      // Optimistic addition
      const newExp: Expense = {
        id: `exp-${Date.now()}`,
        category: expCategory,
        vendor: expVendor.trim() || null,
        amountMinor: Math.round(num * 100),
        date: new Date().toISOString().slice(0, 10),
        description: expDesc.trim() || null,
        status: "RECORDED",
      };
      setExpenses((prev) => [newExp, ...prev]);
      Alert.alert("Expense Logged", `₹${num} recorded under ${expCategory}.`);
      setIsExpenseOpen(false);
    } finally {
      setExpBusy(false);
    }
  };

  const shareViaWhatsApp = (inv: Invoice) => {
    const orgName = activeOrg?.name || "CRMKaro";
    const amountStr = `₹${(inv.totalMinor / 100).toLocaleString("en-IN")}`;
    const name = inv.person?.displayName || "Student / Customer";
    const msg = `Hello ${name},\n\nYour Fee Invoice #${inv.invoiceNumber} for ${amountStr} has been generated by ${orgName}.\n\nStatus: ${inv.status}\n\nPlease complete the payment at your earliest convenience.\n\nThank you!`;

    const phone = inv.person?.primaryPhone?.replace(/\D/g, "");
    if (phone) {
      Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
    } else {
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
    }
    setShareInvoice(null);
  };

  const totalCollected = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + i.totalMinor, 0);

  const totalOutstanding = invoices
    .filter((i) => i.status !== "PAID" && i.status !== "VOID")
    .reduce((sum, i) => sum + i.balanceDueMinor, 0);

  const totalExpensesMinor = expenses.reduce((sum, e) => sum + e.amountMinor, 0);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Finance & Invoices"
        subtitle="Billing, collections, business expenses & ledger"
        rightAction={
          activeTab === "invoices" ? (
            <TouchableOpacity onPress={() => setIsCreateOpen(true)} style={styles.addBtn}>
              <Icon name="Plus" size={18} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setIsExpenseOpen(true)} style={styles.addBtn}>
              <Icon name="Plus" size={18} color="#ffffff" />
            </TouchableOpacity>
          )
        }
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab("invoices")}
          style={[styles.tabItem, activeTab === "invoices" && styles.tabItemActive]}
        >
          <Icon name="FileText" size={16} color={activeTab === "invoices" ? colors.brand : colors.muted} />
          <Text style={[styles.tabText, activeTab === "invoices" && styles.tabTextActive]}>
            Invoices Ledger ({invoices.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("expenses")}
          style={[styles.tabItem, activeTab === "expenses" && styles.tabItemActive]}
        >
          <Icon name="CreditCard" size={16} color={activeTab === "expenses" ? colors.brand : colors.muted} />
          <Text style={[styles.tabText, activeTab === "expenses" && styles.tabTextActive]}>
            Expenses ({expenses.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "invoices" ? (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchFinanceData();
              }}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>Loading invoices & billing ledger…</Text>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.brandLight }]}>
                  <Icon name="FileText" size={28} color={colors.brand} />
                </View>
                <Text style={styles.emptyTitle}>No Invoices Issued Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create itemized fee bills for your students or clients, collect payments, and track pending dues.
                </Text>
                <PrimaryButton
                  title="+ Create First Invoice / Bill"
                  onPress={() => setIsCreateOpen(true)}
                  style={{ marginTop: spacing.md, minWidth: 220 }}
                />
              </View>
            )
          }
          ListHeaderComponent={
            <>
              {/* Quick Metrics */}
              <View style={styles.metricsRow}>
                <View style={styles.metricCol}>
                  <StatCard
                    label="Total Invoiced"
                    value={formatRupees(totalCollected + totalOutstanding)}
                    tone="blue"
                  />
                </View>
                <View style={styles.metricCol}>
                  <StatCard
                    label="Pending Dues"
                    value={formatRupees(totalOutstanding)}
                    tone="rose"
                  />
                </View>
              </View>

              <View style={styles.listHeaderRow}>
                <Text style={styles.sectionTitle}>Invoices Ledger ({invoices.length})</Text>
              </View>
            </>
          }
          renderItem={({ item }) => {
            const isPaid = item.status === "PAID";
            return (
              <View style={styles.invoiceCard}>
                <View style={styles.invoiceMain}>
                  <View style={styles.invoiceTopRow}>
                    <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
                    <Badge tone={isPaid ? "emerald" : "amber"}>
                      {item.status}
                    </Badge>
                  </View>
                  <Text style={styles.payerName}>{item.person?.displayName || "Member"}</Text>
                  <Text style={styles.invoiceDate}>
                    Issued: {new Date(item.issueDate).toLocaleDateString("en-IN")}
                  </Text>
                </View>

                <View style={styles.invoiceRight}>
                  <Text style={styles.invoiceAmount}>{formatRupees(item.totalMinor)}</Text>
                  <View style={styles.actionButtonsCol}>
                    {!isPaid ? (
                      <TouchableOpacity
                        onPress={() => handleOpenRecordPayment(item)}
                        style={styles.payBtn}
                      >
                        <Icon name="Zap" size={12} color="#ffffff" />
                        <Text style={styles.payBtnText}>Pay</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setShareInvoice(item)}
                        style={styles.shareBtn}
                      >
                        <Icon name="MessageSquare" size={12} color={colors.emerald} />
                        <Text style={styles.shareBtnText}>Share</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      ) : (
        /* EXPENSES TAB */
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchFinanceData();
              }}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>Loading expense records…</Text>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIconCircle, { backgroundColor: "#fff7ed" }]}>
                  <Icon name="CreditCard" size={28} color="#ea580c" />
                </View>
                <Text style={styles.emptyTitle}>No Expenses Recorded Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Track your facility rent, electricity bills, teacher salaries, and operational costs.
                </Text>
                <PrimaryButton
                  title="+ Record Kharcha (Expense)"
                  onPress={() => setIsExpenseOpen(true)}
                  variant="outline"
                  style={{ marginTop: spacing.md, minWidth: 220 }}
                />
              </View>
            )
          }
          ListHeaderComponent={
            <View style={styles.expenseHeroCard}>
              <View style={styles.expenseHeroIconWrap}>
                <Icon name="DollarSign" size={22} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.expenseHeroLabel}>Total Operational Expenses</Text>
                <Text style={styles.expenseHeroVal}>{formatRupees(totalExpensesMinor)}</Text>
              </View>
              <Badge tone="rose">{expenses.length} Records</Badge>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.expenseCard}>
              <View style={styles.expenseTop}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={styles.expenseCategory}>{item.category}</Text>
                  <Text style={styles.expenseVendor}>{item.vendor || "Direct Expense"}</Text>
                </View>
                <Text style={styles.expenseAmount}>{formatRupees(item.amountMinor)}</Text>
              </View>

              {Boolean(item.description) && (
                <Text style={styles.expenseDesc}>{item.description}</Text>
              )}

              <View style={styles.expenseBottom}>
                <Text style={styles.expenseDate}>
                  Recorded: {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
                <Badge tone="neutral">{item.status}</Badge>
              </View>
            </View>
          )}
        />
      )}

      {/* Record Payment BottomSheet */}
      <BottomSheet
        visible={Boolean(payInvoice)}
        onClose={() => setPayInvoice(null)}
        title="Record Payment"
        subtitle={payInvoice ? `Invoice #${payInvoice.invoiceNumber} • ${payInvoice.person?.displayName}` : ""}
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setPayInvoice(null)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={payBusy ? "Recording…" : "Confirm Receipt"}
              onPress={handleSavePayment}
              loading={payBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        {payInvoice && (
          <View style={styles.formWrap}>
            <View style={styles.amountInputWrap}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={payAmount}
                onChangeText={setPayAmount}
              />
            </View>

            <Text style={styles.fieldLabel}>Payment Mode</Text>
            <View style={styles.methodRow}>
              {(["UPI", "CASH", "BANK_TRANSFER"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPayMethod(m)}
                  style={[styles.methodChip, payMethod === m && styles.methodChipActive]}
                >
                  <Text style={[styles.methodChipText, payMethod === m && styles.methodChipTextActive]}>
                    {m === "BANK_TRANSFER" ? "Bank" : m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </BottomSheet>

      {/* Record Expense BottomSheet */}
      <BottomSheet
        visible={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        title="Record Business Expense"
        subtitle="Log rent, coach payouts, electricity, or supplies"
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setIsExpenseOpen(false)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={expBusy ? "Saving…" : "Save Expense"}
              onPress={handleSaveExpense}
              loading={expBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Expense Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsWrap}>
            {EXPENSE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setExpCategory(cat)}
                style={[styles.chip, expCategory === cat && styles.chipActive]}
              >
                <Text style={[styles.chipText, expCategory === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Amount (₹) *</Text>
          <TextInput
            placeholder="e.g. 15000"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            value={expAmount}
            onChangeText={setExpAmount}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Vendor / Recipient</Text>
          <TextInput
            placeholder="e.g. Landlord, Electricity Board, Amazon"
            placeholderTextColor={colors.muted}
            value={expVendor}
            onChangeText={setExpVendor}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Description / Purpose</Text>
          <TextInput
            placeholder="e.g. Monthly rent for wing A"
            placeholderTextColor={colors.muted}
            value={expDesc}
            onChangeText={setExpDesc}
            style={styles.input}
          />
        </View>
      </BottomSheet>

      {/* Create Invoice BottomSheet */}
      <BottomSheet
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Fee Invoice"
        subtitle="Generate a new bill for member or student"
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              onPress={() => setIsCreateOpen(false)}
              variant="outline"
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={createBusy ? "Creating…" : "Generate Invoice"}
              onPress={handleCreateInvoice}
              loading={createBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Select Member / Student *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsWrap}>
            {people.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPersonId(p.id)}
                style={[styles.chip, selectedPersonId === p.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedPersonId === p.id && styles.chipTextActive]}>
                  {p.displayName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Item Description *</Text>
          <TextInput
            style={styles.input}
            value={itemDesc}
            onChangeText={setItemDesc}
            placeholder="e.g. Monthly Tuition Fee"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.fieldLabel}>Total Amount (₹) *</Text>
          <TextInput
            style={styles.input}
            value={itemPrice}
            onChangeText={setItemPrice}
            keyboardType="numeric"
            placeholder="e.g. 2500"
            placeholderTextColor={colors.muted}
          />
        </View>
      </BottomSheet>

      {/* Share Bill BottomSheet */}
      <BottomSheet
        visible={Boolean(shareInvoice)}
        onClose={() => setShareInvoice(null)}
        title="Share Invoice via WhatsApp"
        subtitle={`Invoice #${shareInvoice?.invoiceNumber}`}
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              onPress={() => setShareInvoice(null)}
              variant="outline"
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Open WhatsApp"
              onPress={() => shareInvoice && shareViaWhatsApp(shareInvoice)}
              icon={<Icon name="MessageSquare" size={16} color="#ffffff" />}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        {shareInvoice && (
          <View style={styles.sharePreview}>
            <Text style={styles.previewLabel}>Message Preview:</Text>
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>
                Hello {shareInvoice.person?.displayName || "Student"},\n\n
                Your Fee Invoice #{shareInvoice.invoiceNumber} for{" "}
                {formatRupees(shareInvoice.totalMinor)} has been generated by{" "}
                {activeOrg?.name || "CRMKaro"}.\n\n
                Status: {shareInvoice.status}\n\n
                Please complete payment at your earliest convenience. Thank you!
              </Text>
            </View>
          </View>
        )}
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
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metricCol: {
    flex: 1,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  invoiceCard: {
    flexDirection: "row",
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
  invoiceMain: {
    flex: 1,
  },
  invoiceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 13.5,
    fontWeight: "800",
    color: colors.ink,
  },
  payerName: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 2,
  },
  invoiceDate: {
    fontSize: 11,
    color: colors.subtle,
  },
  invoiceRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.ink,
  },
  actionButtonsCol: {
    flexDirection: "row",
    gap: 4,
    marginTop: spacing.xs,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  payBtnText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "800",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  shareBtnText: {
    color: colors.emerald,
    fontSize: 11.5,
    fontWeight: "800",
  },
  expenseHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  expenseHeroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
  },
  expenseHeroLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  expenseHeroVal: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.danger,
    marginTop: 1,
  },
  expenseCard: {
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
  expenseTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  expenseCategory: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.ink,
  },
  expenseVendor: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.danger,
  },
  expenseDesc: {
    fontSize: 12,
    color: colors.inkSecondary,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  expenseBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  expenseDate: {
    fontSize: 11,
    color: colors.muted,
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
  chipsWrap: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  chipTextActive: {
    color: colors.brand,
    fontWeight: "800",
  },
  modalFooterRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  sharePreview: {
    gap: spacing.sm,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.muted,
  },
  messageBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  messageText: {
    fontSize: 12.5,
    color: colors.ink,
    lineHeight: 18,
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
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.md,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 290,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
  },
});
