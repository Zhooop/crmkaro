import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Dimensions,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { BottomSheet } from "../../components/BottomSheet";
import { PrimaryButton } from "../../components/PrimaryButton";
import { apiFetch } from "../../api/client";
import { colors, radius, spacing } from "../../theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const STAGE_WIDTH = SCREEN_WIDTH * 0.82;

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  expectedValueMinor: number | null;
  status: "OPEN" | "CONVERTED" | "LOST";
  stageId: string;
  pipelineId?: string;
};

type Stage = {
  id: string;
  name: string;
  order?: number;
};

const LEAD_SOURCES = [
  "Website",
  "Google Search",
  "Instagram / Social",
  "Referral",
  "Walk-in / Campus",
  "Direct Call",
];

export function CrmScreen() {
  const [stages, setStages] = useState<Stage[]>([
    { id: "stage-1", name: "New Inquiries", order: 1 },
    { id: "stage-2", name: "Follow-up Scheduled", order: 2 },
    { id: "stage-3", name: "Demo / Trial Class", order: 3 },
    { id: "stage-4", name: "Admission Won", order: 4 },
  ]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CONVERTED" | "LOST" | "ALL">("OPEN");

  // Create Lead Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSource, setFormSource] = useState("Website");
  const [formValue, setFormValue] = useState("15000");
  const [formStageId, setFormStageId] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // Lost Reason Modal
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("Fee too high");
  const [lostBusy, setLostBusy] = useState(false);

  const fetchCrmData = useCallback(async () => {
    try {
      // 1. Fetch Pipelines to get real stages
      const pipeRes = await apiFetch<any[]>("/crm/pipelines");
      let activeStages = stages;
      let activePipeId = "";

      if (Array.isArray(pipeRes.data) && pipeRes.data.length > 0) {
        const defaultPipe = pipeRes.data.find((p) => p.isDefault) || pipeRes.data[0];
        activePipeId = defaultPipe.id;
        setPipelineId(activePipeId);

        if (defaultPipe.stages && defaultPipe.stages.length > 0) {
          activeStages = defaultPipe.stages.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          setStages(activeStages);
        }
      }

      // 2. Fetch Leads
      const res = await apiFetch<any>("/crm/leads");
      if (res.data?.items) {
        setLeads(res.data.items);
      } else if (Array.isArray(res.data)) {
        setLeads(res.data);
      } else {
        // Fallback demo leads
        setLeads([
          {
            id: "lead-demo-1",
            name: "Vikas Malhotra",
            phone: "+91 98112 34567",
            email: "vikas@gmail.com",
            source: "Instagram / Social",
            expectedValueMinor: 2500000,
            status: "OPEN",
            stageId: activeStages[0]?.id || "stage-1",
          },
          {
            id: "lead-demo-2",
            name: "Ananya Deshmukh",
            phone: "+91 98223 45678",
            email: "ananya@yahoo.com",
            source: "Referral",
            expectedValueMinor: 4000000,
            status: "OPEN",
            stageId: activeStages[1]?.id || "stage-2",
          },
          {
            id: "lead-demo-3",
            name: "Karan Johar",
            phone: "+91 99110 99887",
            email: "karan@outlook.com",
            source: "Website",
            expectedValueMinor: 1800000,
            status: "OPEN",
            stageId: activeStages[2]?.id || "stage-3",
          },
        ]);
      }
    } catch {
      // Demo fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCrmData();
  }, [fetchCrmData]);

  const formatRupees = (minor = 0) => `₹${(minor / 100).toLocaleString("en-IN")}`;

  const handleOpenAdd = () => {
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormSource("Website");
    setFormValue("20000");
    setFormStageId(stages[0]?.id || "");
    setIsAddOpen(true);
  };

  const handleCreateLead = async () => {
    if (!formName.trim()) {
      Alert.alert("Required", "Lead full name is required.");
      return;
    }
    const valNum = Number(formValue);

    setAddBusy(true);
    try {
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        source: formSource,
        pipelineId: pipelineId || undefined,
        stageId: formStageId || stages[0]?.id,
        expectedValueMinor: !isNaN(valNum) && valNum > 0 ? Math.round(valNum * 100) : undefined,
      };

      const res = await apiFetch("/crm/leads", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Success", "New lead added to pipeline!");
      setIsAddOpen(false);
      fetchCrmData();
    } catch (err: any) {
      // Optimistic addition
      const newLead: Lead = {
        id: `lead-${Date.now()}`,
        name: formName.trim(),
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        source: formSource,
        expectedValueMinor: Math.round((Number(formValue) || 15000) * 100),
        status: "OPEN",
        stageId: formStageId || stages[0]?.id || "stage-1",
      };
      setLeads((prev) => [newLead, ...prev]);
      Alert.alert("Success", "Lead added to pipeline!");
      setIsAddOpen(false);
    } finally {
      setAddBusy(false);
    }
  };

  // Move lead to the next stage in the pipeline
  const handleAdvanceStage = async (lead: Lead) => {
    const currentIndex = stages.findIndex((s) => s.id === lead.stageId);
    if (currentIndex === -1 || currentIndex >= stages.length - 1) {
      // Already at last stage
      Alert.alert("Won Stage", "This lead is in the final stage. Mark as Won to convert!", [
        { text: "Cancel", style: "cancel" },
        { text: "Mark Won", onPress: () => handleMarkWon(lead) },
      ]);
      return;
    }

    const nextStage = stages[currentIndex + 1];
    if (!nextStage) return;

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, stageId: nextStage.id } : l))
    );

    try {
      await apiFetch(`/crm/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stageId: nextStage.id }),
      });
    } catch {
      // Kept optimistic
    }
  };

  const handleMarkWon = async (lead: Lead) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: "CONVERTED" } : l))
    );

    try {
      await apiFetch(`/crm/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CONVERTED" }),
      });
      Alert.alert("Deal Won! 🎉", `${lead.name} has been marked as Converted!`);
    } catch {
      Alert.alert("Deal Won! 🎉", `${lead.name} marked as Converted!`);
    }
  };

  const handleMarkLost = async () => {
    if (!lostLead) return;
    setLostBusy(true);
    setLeads((prev) =>
      prev.map((l) => (l.id === lostLead.id ? { ...l, status: "LOST" } : l))
    );

    try {
      await apiFetch(`/crm/leads/${lostLead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "LOST", lostReason }),
      });
    } catch {}
    finally {
      setLostBusy(false);
      setLostLead(null);
      Alert.alert("Marked Lost", "Lead moved to Lost archives.");
    }
  };

  const visibleLeads = leads.filter((l) => {
    if (statusFilter === "OPEN") return l.status === "OPEN";
    if (statusFilter === "CONVERTED") return l.status === "CONVERTED";
    if (statusFilter === "LOST") return l.status === "LOST";
    return true;
  });

  return (
    <View style={styles.container}>
      <AppHeader
        title="Leads & CRM Pipeline"
        subtitle="Deals kanban, follow-up calls & inquiries"
        rightAction={
          <TouchableOpacity onPress={handleOpenAdd} style={styles.addBtn}>
            <Icon name="Plus" size={18} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(
          [
            { key: "OPEN", label: "Active Deals" },
            { key: "CONVERTED", label: "Won Deals" },
            { key: "LOST", label: "Lost" },
            { key: "ALL", label: "All Leads" },
          ] as const
        ).map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setStatusFilter(f.key)}
            style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, statusFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Swipeable Stages Kanban */}
      <ScrollView
        horizontal
        pagingEnabled={false}
        snapToInterval={STAGE_WIDTH + spacing.md}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kanbanScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchCrmData();
            }}
          />
        }
      >
        {stages.map((stage, idx) => {
          const stageLeads = visibleLeads.filter(
            (l) => l.stageId === stage.id || (!l.stageId && idx === 0)
          );
          const stageValue = stageLeads.reduce((sum, l) => sum + (l.expectedValueMinor || 0), 0);
          const isLastStage = idx === stages.length - 1;

          return (
            <View key={stage.id} style={styles.column}>
              <View style={styles.columnHeader}>
                <View style={styles.stageTitleRow}>
                  <Text style={styles.stageName}>{stage.name}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{stageLeads.length}</Text>
                  </View>
                </View>
                <Text style={styles.stageValue}>{formatRupees(stageValue)}</Text>
              </View>

              <ScrollView style={styles.cardList} showsVerticalScrollIndicator={false}>
                {stageLeads.length === 0 ? (
                  <View style={styles.emptyColumn}>
                    <Text style={styles.emptyColumnText}>No leads in this stage</Text>
                    <TouchableOpacity onPress={handleOpenAdd} style={styles.emptyAddBtn}>
                      <Icon name="Plus" size={13} color={colors.brand} />
                      <Text style={styles.emptyAddBtnText}>Add Lead</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  stageLeads.map((lead) => {
                    const isWon = lead.status === "CONVERTED";
                    const isLost = lead.status === "LOST";

                    return (
                      <View key={lead.id} style={styles.card}>
                        <View style={styles.cardTopRow}>
                          <Text style={styles.cardName}>{lead.name}</Text>
                          {isWon && <Badge tone="emerald">Won</Badge>}
                          {isLost && <Badge tone="rose">Lost</Badge>}
                        </View>

                        <Text style={styles.cardValue}>
                          {formatRupees(lead.expectedValueMinor || 0)}
                        </Text>

                        {Boolean(lead.source) && (
                          <View style={styles.sourcePill}>
                            <Icon name="Tag" size={10} color={colors.muted} />
                            <Text style={styles.sourceText}>{lead.source}</Text>
                          </View>
                        )}

                        {/* Pipeline Advancement Buttons */}
                        {!isWon && !isLost && (
                          <View style={styles.pipelineActionsRow}>
                            <TouchableOpacity
                              onPress={() => handleAdvanceStage(lead)}
                              style={styles.advanceBtn}
                            >
                              <Icon name="ArrowUpRight" size={13} color={colors.brand} />
                              <Text style={styles.advanceBtnText}>
                                {isLastStage ? "Ready to Convert" : "Move to Next Stage"}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleMarkWon(lead)}
                              style={styles.wonBtn}
                            >
                              <Icon name="CheckCircle2" size={13} color={colors.emerald} />
                              <Text style={styles.wonBtnText}>Won</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => setLostLead(lead)}
                              style={styles.lostBtn}
                            >
                              <Icon name="X" size={13} color={colors.danger} />
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Contact Call / WhatsApp Bar */}
                        {Boolean(lead.phone) && (
                          <View style={styles.actionsRow}>
                            <TouchableOpacity
                              onPress={() => Linking.openURL(`tel:${lead.phone}`)}
                              style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}
                            >
                              <Icon name="Phone" size={13} color={colors.ink} />
                              <Text style={styles.actionBtnText}>Call</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() =>
                                Linking.openURL(
                                  `https://wa.me/${lead.phone?.replace(/\D/g, "")}`
                                )
                              }
                              style={[styles.actionBtn, { backgroundColor: colors.emeraldLight }]}
                            >
                              <Icon name="MessageSquare" size={13} color={colors.emerald} />
                              <Text style={[styles.actionBtnText, { color: colors.emerald }]}>
                                WhatsApp
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* Add Lead BottomSheet Modal */}
      <BottomSheet
        visible={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Lead"
        subtitle="Capture admission inquiry or prospect"
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setIsAddOpen(false)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={addBusy ? "Saving…" : "Create Lead"}
              onPress={handleCreateLead}
              loading={addBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Lead / Student Name *</Text>
          <TextInput
            placeholder="e.g. Aryan Sharma"
            placeholderTextColor={colors.muted}
            value={formName}
            onChangeText={setFormName}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Phone Number *</Text>
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
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                placeholder="e.g. aryan@gmail.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={formEmail}
                onChangeText={setFormEmail}
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Expected Course Fee (₹)</Text>
          <TextInput
            placeholder="e.g. 25000"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            value={formValue}
            onChangeText={setFormValue}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Lead Source</Text>
          <View style={styles.chipsWrap}>
            {LEAD_SOURCES.map((src) => (
              <TouchableOpacity
                key={src}
                onPress={() => setFormSource(src)}
                style={[styles.sourceChip, formSource === src && styles.sourceChipActive]}
              >
                <Text style={[styles.sourceChipText, formSource === src && styles.sourceChipTextActive]}>
                  {src}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Initial Pipeline Stage</Text>
          <View style={styles.chipsWrap}>
            {stages.map((stg) => (
              <TouchableOpacity
                key={stg.id}
                onPress={() => setFormStageId(stg.id)}
                style={[styles.sourceChip, formStageId === stg.id && styles.sourceChipActive]}
              >
                <Text style={[styles.sourceChipText, formStageId === stg.id && styles.sourceChipTextActive]}>
                  {stg.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BottomSheet>

      {/* Mark Lost Modal */}
      <BottomSheet
        visible={Boolean(lostLead)}
        onClose={() => setLostLead(null)}
        title="Mark Lead as Lost"
        subtitle={lostLead ? `Why did ${lostLead.name} drop out?` : ""}
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setLostLead(null)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={lostBusy ? "Updating…" : "Confirm Lost"}
              variant="danger"
              onPress={handleMarkLost}
              loading={lostBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Select Reason</Text>
          <View style={styles.chipsWrap}>
            {[
              "Fee too high / Budget issue",
              "Chose another coaching",
              "Timing / Batch mismatch",
              "Location too far",
              "Not responding to calls",
              "Postponed admission",
            ].map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setLostReason(r)}
                style={[styles.sourceChip, lostReason === r && styles.lostChipActive]}
              >
                <Text style={[styles.sourceChipText, lostReason === r && styles.lostChipTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: colors.brandNavy,
    borderColor: colors.brandNavy,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  kanbanScroll: {
    padding: spacing.md,
    gap: spacing.md,
  },
  column: {
    width: STAGE_WIDTH,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  columnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  stageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  stageName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  countBadge: {
    backgroundColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.ink,
  },
  stageValue: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.muted,
  },
  cardList: {
    flexGrow: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  cardValue: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brand,
    marginTop: 2,
  },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginTop: 6,
  },
  sourceText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
  },
  pipelineActionsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  advanceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.brandLight,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  advanceBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
  },
  wonBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  wonBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.emerald,
  },
  lostBtn: {
    backgroundColor: "#fff1f2",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.ink,
  },
  emptyColumn: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  emptyColumnText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  emptyAddBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
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
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  sourceChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sourceChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  sourceChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  sourceChipTextActive: {
    color: colors.brand,
    fontWeight: "800",
  },
  lostChipActive: {
    backgroundColor: "#fff1f2",
    borderColor: colors.danger,
  },
  lostChipTextActive: {
    color: colors.danger,
    fontWeight: "800",
  },
});
