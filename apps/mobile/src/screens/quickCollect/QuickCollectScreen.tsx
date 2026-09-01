import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

type Person = {
  id: string;
  displayName: string;
  primaryPhone: string | null;
  email: string | null;
};

export function QuickCollectScreen() {
  const { activeOrg } = useAuth();
  const [feeAmount, setFeeAmount] = useState("1000");
  const [notes, setNotes] = useState("Academic & Training Fees");
  const [people, setPeople] = useState<Person[]>([]);
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successInvoices, setSuccessInvoices] = useState<any[] | null>(null);

  const fetchPeople = useCallback(async () => {
    const res = await apiFetch<{ items: Person[] }>("/people?limit=100");
    if (res.data?.items) {
      setPeople(res.data.items);
      setFilteredPeople(res.data.items);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredPeople(people);
    } else {
      const q = search.toLowerCase();
      setFilteredPeople(
        people.filter(
          (p) =>
            p.displayName.toLowerCase().includes(q) ||
            p.primaryPhone?.includes(q)
        )
      );
    }
  }, [search, people]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSend = async () => {
    const num = Number(feeAmount);
    if (num < 2) {
      Alert.alert("Invalid Amount", "Please enter a valid amount (minimum ₹2).");
      return;
    }
    if (selectedIds.size === 0) {
      Alert.alert("No Payer Selected", "Please select at least one member to collect fees from.");
      return;
    }

    setSubmitting(true);
    const amountMinor = Math.round(num * 100);
    const targetPeople = people.filter((p) => selectedIds.has(p.id));

    const results: any[] = [];
    for (const p of targetPeople) {
      const res = await apiFetch("/finance/invoices", {
        method: "POST",
        body: JSON.stringify({
          personId: p.id,
          issueDate: new Date().toISOString(),
          items: [
            {
              description: notes || "Fee Collection",
              quantity: 1,
              unitPriceMinor: amountMinor,
            },
          ],
        }),
      });

      if (res.data) {
        results.push({
          name: p.displayName,
          phone: p.primaryPhone,
          amountMinor,
          notes,
          invoiceNumber: res.data.invoiceNumber || "INV-REC",
        });
      }
    }

    setSubmitting(false);
    if (results.length > 0) {
      setSuccessInvoices(results);
    } else {
      Alert.alert("Error", "Failed to create fee collection invoices.");
    }
  };

  const openWhatsApp = (item: any) => {
    const orgName = activeOrg?.name || "CRMKaro";
    const amountStr = `₹${(item.amountMinor / 100).toLocaleString("en-IN")}`;
    const msg = `Hello ${item.name}, your fee payment of ${amountStr} for "${item.notes}" is requested. Reference: ${item.invoiceNumber}. Please make the payment at your earliest convenience. Thank you! - ${orgName}`;
    const url = `https://wa.me/${item.phone?.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Quick Collect" subtitle="1-Tap Instant Fee Collection & POS" />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Success View */}
        {successInvoices ? (
          <View style={styles.successCard}>
            <Text style={styles.successHeading}>
              🎉 {successInvoices.length} Requests Generated!
            </Text>
            <Text style={styles.successSub}>
              Tap below to send 1-click WhatsApp payment reminders:
            </Text>

            {successInvoices.map((inv, idx) => (
              <View key={idx} style={styles.successItem}>
                <View style={styles.successItemMeta}>
                  <Text style={styles.successPayer}>{inv.name}</Text>
                  <Text style={styles.successAmount}>₹{inv.amountMinor / 100}</Text>
                </View>
                {Boolean(inv.phone) && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => openWhatsApp(inv)}
                    style={styles.waBtn}
                  >
                    <Icon name="MessageSquare" size={14} color="#ffffff" />
                    <Text style={styles.waBtnText}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <PrimaryButton
              title="Create Another Collection"
              onPress={() => {
                setSuccessInvoices(null);
                setSelectedIds(new Set());
              }}
              variant="outline"
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <>
            {/* Amount Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Enter Amount</Text>
              <Text style={styles.cardSubtitle}>Amount each selected payer will be billed</Text>

              <View style={styles.amountInputRow}>
                <View style={styles.currencyPill}>
                  <Text style={styles.currencyText}>₹</Text>
                </View>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="numeric"
                  value={feeAmount}
                  onChangeText={setFeeAmount}
                  placeholder="0"
                />
              </View>

              {/* Presets Chips */}
              <View style={styles.presetsRow}>
                {PRESET_AMOUNTS.map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setFeeAmount(amt.toString())}
                    style={[
                      styles.presetChip,
                      feeAmount === amt.toString() && styles.presetChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        feeAmount === amt.toString() && styles.presetChipTextActive,
                      ]}
                    >
                      ₹{amt.toLocaleString("en-IN")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.cardTitle, { marginTop: spacing.lg }]}>Notes / Reason</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="e.g. Monthly Tuition, Registration Fee"
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            {/* Select Payers Card */}
            <View style={styles.card}>
              <View style={styles.payersHeader}>
                <Text style={styles.cardTitle}>Select Payers ({filteredPeople.length})</Text>
                <Badge tone="emerald">Selected {selectedIds.size}</Badge>
              </View>

              <SearchInput
                placeholder="Search member name or phone..."
                value={search}
                onChangeText={setSearch}
              />

              <View style={styles.payerList}>
                {filteredPeople.map((person) => {
                  const isSelected = selectedIds.has(person.id);
                  return (
                    <TouchableOpacity
                      key={person.id}
                      activeOpacity={0.7}
                      onPress={() => toggleSelect(person.id)}
                      style={[styles.payerItem, isSelected && styles.payerItemActive]}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected && <Icon name="Check" size={12} color="#ffffff" />}
                      </View>
                      <View style={styles.payerMeta}>
                        <Text style={styles.payerName}>{person.displayName}</Text>
                        <Text style={styles.payerPhone}>{person.primaryPhone || "No Phone"}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Submit Bar */}
            <PrimaryButton
              title={`Request ₹${feeAmount || 0} from ${selectedIds.size} Payer${selectedIds.size === 1 ? "" : "s"}`}
              onPress={handleSend}
              loading={submitting}
              variant="emerald"
              disabled={selectedIds.size === 0 || !feeAmount}
              style={styles.submitBtn}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    height: 48,
  },
  currencyPill: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    height: "100%",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  currencyText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.inkSecondary,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    paddingHorizontal: spacing.md,
  },
  presetsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  presetChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
  },
  presetChipActive: {
    backgroundColor: colors.emeraldLight,
    borderColor: colors.emeraldBorder,
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  presetChipTextActive: {
    color: colors.emerald,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 42,
    marginTop: spacing.xs,
    fontSize: 13.5,
    color: colors.ink,
  },
  payersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  payerList: {
    marginTop: spacing.md,
    maxHeight: 280,
  },
  payerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineLight,
  },
  payerItemActive: {
    backgroundColor: colors.emeraldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.subtle,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  checkboxActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  payerMeta: {
    flex: 1,
  },
  payerName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.ink,
  },
  payerPhone: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  submitBtn: {
    height: 48,
    borderRadius: radius.md,
  },
  successCard: {
    backgroundColor: colors.emeraldLight,
    borderColor: colors.emeraldBorder,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  successHeading: {
    fontSize: 17,
    fontWeight: "800",
    color: "#065f46",
  },
  successSub: {
    fontSize: 12.5,
    color: "#047857",
    marginTop: 2,
    marginBottom: spacing.md,
  },
  successItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.emeraldBorder,
  },
  successItemMeta: {
    flex: 1,
  },
  successPayer: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.ink,
  },
  successAmount: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.emerald,
    marginTop: 1,
  },
  waBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.whatsapp,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  waBtnText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "700",
  },
});
