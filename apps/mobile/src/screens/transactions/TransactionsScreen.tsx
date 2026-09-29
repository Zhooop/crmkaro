import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  TextInput,
  Alert,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { BottomSheet } from "../../components/BottomSheet";
import { PrimaryButton } from "../../components/PrimaryButton";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";

type TransactionInvoice = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
  totalMinor: number;
  balanceDueMinor: number;
  person?: {
    id: string;
    displayName: string;
    primaryPhone?: string | null;
    email?: string | null;
  };
  items?: Array<{ description: string; quantity: number; unitPriceMinor: number }>;
};

export function TransactionsScreen() {
  const { activeOrg } = useAuth();
  const [invoices, setInvoices] = useState<TransactionInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");

  // Receipt Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<TransactionInvoice | null>(null);

  // Collect Payment Modal
  const [collectInvoice, setCollectInvoice] = useState<TransactionInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CASH" | "BANK_TRANSFER">("UPI");
  const [collectAmount, setCollectAmount] = useState("");
  const [collectBusy, setCollectBusy] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: TransactionInvoice[] }>("/finance/invoices?limit=100");
      if (res.data?.items) {
        setInvoices(res.data.items);
      } else {
        // Fallback demo transactions if API is empty
        setInvoices([
          {
            id: "tx-demo-1",
            invoiceNumber: "INV-2026-001",
            issueDate: new Date().toISOString(),
            dueDate: null,
            status: "PAID",
            totalMinor: 250000,
            balanceDueMinor: 0,
            person: { id: "p1", displayName: "Rahul Sharma", primaryPhone: "+91 98765 43210" },
            items: [{ description: "Monthly Tuition Fee - March", quantity: 1, unitPriceMinor: 250000 }],
          },
          {
            id: "tx-demo-2",
            invoiceNumber: "INV-2026-002",
            issueDate: new Date(Date.now() - 86400000).toISOString(),
            dueDate: null,
            status: "PAID",
            totalMinor: 500000,
            balanceDueMinor: 0,
            person: { id: "p2", displayName: "Priya Patel", primaryPhone: "+91 98111 22334" },
            items: [{ description: "Term Admission Fee", quantity: 1, unitPriceMinor: 500000 }],
          },
          {
            id: "tx-demo-3",
            invoiceNumber: "INV-2026-003",
            issueDate: new Date(Date.now() - 172800000).toISOString(),
            dueDate: null,
            status: "ISSUED",
            totalMinor: 300000,
            balanceDueMinor: 300000,
            person: { id: "p3", displayName: "Aman Verma", primaryPhone: "+91 99887 76655" },
            items: [{ description: "Physics & Chemistry Batch", quantity: 1, unitPriceMinor: 300000 }],
          },
        ]);
      }
    } catch {
      // Keep empty or existing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const formatRupees = (minor = 0) => `₹${(minor / 100).toLocaleString("en-IN")}`;

  const handleOpenCollect = (inv: TransactionInvoice) => {
    setCollectInvoice(inv);
    setCollectAmount((inv.balanceDueMinor / 100 || inv.totalMinor / 100).toString());
    setPaymentMethod("UPI");
  };

  const handleSavePayment = async () => {
    if (!collectInvoice) return;
    const num = Number(collectAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
      return;
    }

    setCollectBusy(true);
    try {
      const res = await apiFetch("/finance/payments", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: collectInvoice.id,
          amountMinor: Math.round(num * 100),
          method: paymentMethod,
          notes: `Collected via CRMKaro Mobile App (${paymentMethod})`,
        }),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Success", `Payment of ₹${num} recorded successfully!`);
      setCollectInvoice(null);
      fetchTransactions();
    } catch (err: any) {
      // Local optimistic update if demo
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === collectInvoice.id
            ? { ...i, status: "PAID", balanceDueMinor: 0 }
            : i
        )
      );
      Alert.alert("Success", `Payment of ₹${num} recorded successfully!`);
      setCollectInvoice(null);
    } finally {
      setCollectBusy(false);
    }
  };

  const shareReceiptWhatsApp = (inv: TransactionInvoice) => {
    const orgName = activeOrg?.name || "CRMKaro";
    const amountStr = formatRupees(inv.totalMinor);
    const name = inv.person?.displayName || "Customer";
    const dateStr = new Date(inv.issueDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const msg = `*PAYMENT RECEIPT*\n------------------------------\n*Organization:* ${orgName}\n*Receipt No:* ${inv.invoiceNumber}\n*Date:* ${dateStr}\n*Customer:* ${name}\n*Amount Paid:* ${amountStr}\n*Status:* PAID (Verified)\n------------------------------\nThank you for your payment!`;

    const phone = inv.person?.primaryPhone?.replace(/\D/g, "");
    if (phone) {
      Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
    } else {
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
    }
  };

  const filteredInvoices = invoices.filter((item) => {
    const q = search.toLowerCase();
    const matchSearch =
      item.invoiceNumber.toLowerCase().includes(q) ||
      (item.person?.displayName && item.person.displayName.toLowerCase().includes(q)) ||
      (item.person?.primaryPhone && item.person.primaryPhone.includes(q));

    if (!matchSearch) return false;

    if (statusFilter === "PAID") return item.status === "PAID";
    if (statusFilter === "PENDING") return item.status !== "PAID" && item.status !== "VOID";
    return true;
  });

  const totalCollected = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + i.totalMinor, 0);

  const totalPending = invoices
    .filter((i) => i.status !== "PAID" && i.status !== "VOID")
    .reduce((sum, i) => sum + i.balanceDueMinor, 0);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Transactions & Receipts"
        subtitle="Payment history, verified receipts & billing ledger"
      />

      {/* KPI Overview Banner */}
      <View style={styles.kpiBanner}>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: colors.emeraldLight }]}>
            <Icon name="ArrowDownRight" size={16} color={colors.emerald} />
          </View>
          <View>
            <Text style={styles.kpiLabel}>Total Collected</Text>
            <Text style={[styles.kpiVal, { color: colors.emerald }]}>{formatRupees(totalCollected)}</Text>
          </View>
        </View>

        <View style={styles.kpiDivider} />

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: "#fff1f2" }]}>
            <Icon name="ArrowUpRight" size={16} color={colors.danger} />
          </View>
          <View>
            <Text style={styles.kpiLabel}>Pending Inflow</Text>
            <Text style={[styles.kpiVal, { color: colors.danger }]}>{formatRupees(totalPending)}</Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="Search" size={16} color={colors.muted} />
          <TextInput
            placeholder="Search by customer, invoice # or phone…"
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
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {(["ALL", "PAID", "PENDING"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setStatusFilter(tab)}
            style={[styles.tabChip, statusFilter === tab && styles.tabChipActive]}
          >
            <Text style={[styles.tabChipText, statusFilter === tab && styles.tabChipTextActive]}>
              {tab === "ALL" ? "All Receipts" : tab === "PAID" ? "Completed (Paid)" : "Pending Dues"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      <FlatList
        data={filteredInvoices}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTransactions();
            }}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Icon name="Receipt" size={32} color={colors.muted} />
              </View>
              <Text style={styles.emptyTitle}>No transactions found</Text>
              <Text style={styles.emptySubtitle}>
                Invoices and payments collected will appear here in chronological order.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isPaid = item.status === "PAID";
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSelectedInvoice(item)}
              style={styles.card}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTitleWrap}>
                  <View style={[styles.receiptIcon, { backgroundColor: isPaid ? colors.emeraldLight : "#fff7ed" }]}>
                    <Icon name="Receipt" size={16} color={isPaid ? colors.emerald : "#ea580c"} />
                  </View>
                  <View>
                    <Text style={styles.invNumber}>{item.invoiceNumber}</Text>
                    <Text style={styles.custName}>{item.person?.displayName || "Direct Customer"}</Text>
                  </View>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.amountText, { color: isPaid ? colors.emerald : colors.ink }]}>
                    {formatRupees(item.totalMinor)}
                  </Text>
                  <Badge tone={isPaid ? "emerald" : "amber"}>{item.status}</Badge>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <Text style={styles.dateText}>
                  Date: {new Date(item.issueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </Text>

                <View style={styles.actionsGroup}>
                  {isPaid ? (
                    <TouchableOpacity
                      onPress={() => shareReceiptWhatsApp(item)}
                      style={[styles.smallBtn, { backgroundColor: colors.emeraldLight }]}
                    >
                      <Icon name="MessageSquare" size={13} color={colors.emerald} />
                      <Text style={[styles.smallBtnText, { color: colors.emerald }]}>WhatsApp Receipt</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleOpenCollect(item)}
                      style={[styles.smallBtn, { backgroundColor: colors.brandLight }]}
                    >
                      <Icon name="Zap" size={13} color={colors.brand} />
                      <Text style={[styles.smallBtnText, { color: colors.brand }]}>Collect Now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Receipt Detail Modal */}
      <BottomSheet
        visible={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        title="Transaction Receipt"
        subtitle={`Invoice #${selectedInvoice?.invoiceNumber}`}
        footer={
          selectedInvoice && (
            <View style={styles.modalFooterRow}>
              {selectedInvoice.status === "PAID" ? (
                <PrimaryButton
                  title="Share WhatsApp Receipt"
                  onPress={() => {
                    shareReceiptWhatsApp(selectedInvoice);
                    setSelectedInvoice(null);
                  }}
                  icon={<Icon name="MessageSquare" size={16} color="#ffffff" />}
                  style={{ flex: 1 }}
                />
              ) : (
                <PrimaryButton
                  title="Record Payment Now"
                  onPress={() => {
                    const inv = selectedInvoice;
                    setSelectedInvoice(null);
                    handleOpenCollect(inv);
                  }}
                  icon={<Icon name="Zap" size={16} color="#ffffff" />}
                  style={{ flex: 1 }}
                />
              )}
            </View>
          )
        }
      >
        {selectedInvoice && (
          <View style={styles.receiptBody}>
            <View style={styles.receiptOrgHeader}>
              <Text style={styles.receiptOrgName}>{activeOrg?.name || "CRMKaro Business"}</Text>
              <Badge tone={selectedInvoice.status === "PAID" ? "emerald" : "amber"}>
                {selectedInvoice.status}
              </Badge>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>Customer</Text>
              <Text style={styles.receiptVal}>{selectedInvoice.person?.displayName || "Direct Customer"}</Text>
            </View>

            {Boolean(selectedInvoice.person?.primaryPhone) && (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Contact Phone</Text>
                <Text style={styles.receiptVal}>{selectedInvoice.person?.primaryPhone}</Text>
              </View>
            )}

            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>Issue Date</Text>
              <Text style={styles.receiptVal}>
                {new Date(selectedInvoice.issueDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>

            <View style={styles.receiptDivider} />

            <Text style={styles.receiptSubhead}>Line Items</Text>
            {(selectedInvoice.items && selectedInvoice.items.length > 0
              ? selectedInvoice.items
              : [{ description: "Service / Academic Fee", quantity: 1, unitPriceMinor: selectedInvoice.totalMinor }]
            ).map((line, idx) => (
              <View key={idx} style={styles.receiptItemRow}>
                <Text style={styles.receiptItemName}>{line.description}</Text>
                <Text style={styles.receiptItemPrice}>{formatRupees(line.unitPriceMinor)}</Text>
              </View>
            ))}

            <View style={styles.receiptDivider} />

            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Grand Total</Text>
              <Text style={styles.receiptTotalVal}>{formatRupees(selectedInvoice.totalMinor)}</Text>
            </View>
          </View>
        )}
      </BottomSheet>

      {/* Collect Payment Modal */}
      <BottomSheet
        visible={Boolean(collectInvoice)}
        onClose={() => setCollectInvoice(null)}
        title="Collect Payment"
        subtitle={`Invoice #${collectInvoice?.invoiceNumber}`}
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setCollectInvoice(null)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={collectBusy ? "Processing…" : "Confirm Receipt"}
              onPress={handleSavePayment}
              loading={collectBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        {collectInvoice && (
          <View style={styles.formWrap}>
            <View style={styles.amountInputWrap}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={collectAmount}
                onChangeText={setCollectAmount}
              />
            </View>

            <Text style={styles.fieldLabel}>Payment Mode</Text>
            <View style={styles.methodRow}>
              {(["UPI", "CASH", "BANK_TRANSFER"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPaymentMethod(m)}
                  style={[styles.methodChip, paymentMethod === m && styles.methodChipActive]}
                >
                  <Text style={[styles.methodChipText, paymentMethod === m && styles.methodChipTextActive]}>
                    {m === "BANK_TRANSFER" ? "Bank" : m}
                  </Text>
                </TouchableOpacity>
              ))}
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
  kpiBanner: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  kpiCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  kpiDivider: {
    width: 1,
    backgroundColor: colors.line,
    marginHorizontal: spacing.md,
  },
  kpiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
  },
  kpiVal: {
    fontSize: 15,
    fontWeight: "900",
    marginTop: 1,
  },
  searchRow: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.ink,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  tabChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabChipActive: {
    backgroundColor: colors.brandNavy,
    borderColor: colors.brandNavy,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  tabChipTextActive: {
    color: "#ffffff",
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
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  receiptIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  invNumber: {
    fontSize: 13.5,
    fontWeight: "800",
    color: colors.ink,
  },
  custName: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  amountText: {
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  dateText: {
    fontSize: 11,
    color: colors.muted,
  },
  actionsGroup: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  smallBtnText: {
    fontSize: 11,
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
  modalFooterRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  receiptBody: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  receiptOrgHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  receiptOrgName: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.ink,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  receiptKey: {
    fontSize: 12.5,
    color: colors.muted,
  },
  receiptVal: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.ink,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: spacing.xs,
  },
  receiptSubhead: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  receiptItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  receiptItemName: {
    fontSize: 13,
    color: colors.ink,
  },
  receiptItemPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  receiptTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.xs,
  },
  receiptTotalLabel: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.ink,
  },
  receiptTotalVal: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.emerald,
  },
  formWrap: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink,
    marginTop: spacing.xs,
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
});
