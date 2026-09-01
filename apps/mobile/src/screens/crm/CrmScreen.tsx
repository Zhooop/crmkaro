import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Dimensions,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Icon } from "../../components/Icon";
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
};

type Stage = {
  id: string;
  name: string;
};

export function CrmScreen() {
  const [stages, setStages] = useState<Stage[]>([
    { id: "1", name: "New Inquiries" },
    { id: "2", name: "Follow-up Scheduled" },
    { id: "3", name: "Demo / Trial" },
    { id: "4", name: "Admission Won" },
  ]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCrmData = useCallback(async () => {
    try {
      const res = await apiFetch<any>("/crm/leads");
      if (res.data?.items) {
        setLeads(res.data.items);
      } else {
        // Fallback sample data if empty
        setLeads([
          {
            id: "l1",
            name: "Ananya Deshmukh",
            phone: "+91 9820123456",
            email: "ananya@example.com",
            source: "Instagram Ad",
            expectedValueMinor: 1500000,
            status: "OPEN",
            stageId: "1",
          },
          {
            id: "l2",
            name: "Rohan Varma",
            phone: "+91 9876543210",
            email: "rohan@example.com",
            source: "Referral",
            expectedValueMinor: 2500000,
            status: "OPEN",
            stageId: "2",
          },
          {
            id: "l3",
            name: "Pooja Patil",
            phone: "+91 9988776655",
            email: null,
            source: "Walk-in",
            expectedValueMinor: 1200000,
            status: "OPEN",
            stageId: "3",
          },
        ]);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCrmData();
  }, [fetchCrmData]);

  const formatRupees = (minor = 0) => `₹${(minor / 100).toLocaleString("en-IN")}`;

  return (
    <View style={styles.container}>
      <AppHeader
        title="Leads Pipeline"
        subtitle="Swipeable Stage Kanban & Follow-ups"
      />

      <ScrollView
        horizontal
        pagingEnabled={false}
        snapToInterval={STAGE_WIDTH + spacing.md}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kanbanScroll}
      >
        {stages.map((stage) => {
          const stageLeads = leads.filter((l) => l.stageId === stage.id || (!l.stageId && stage.id === "1"));
          const stageValue = stageLeads.reduce((sum, l) => sum + (l.expectedValueMinor || 0), 0);

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
                {stageLeads.map((lead) => (
                  <View key={lead.id} style={styles.card}>
                    <Text style={styles.cardName}>{lead.name}</Text>
                    <Text style={styles.cardValue}>
                      {formatRupees(lead.expectedValueMinor || 0)}
                    </Text>

                    {Boolean(lead.source) && (
                      <View style={styles.sourcePill}>
                        <Text style={styles.sourceText}>{lead.source}</Text>
                      </View>
                    )}

                    {/* Quick Call / WhatsApp Bar */}
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
                ))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  kanbanScroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  column: {
    width: STAGE_WIDTH,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    maxHeight: "92%",
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
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.inkSecondary,
  },
  stageValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  cardList: {
    flexGrow: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  cardValue: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brand,
    marginTop: 2,
  },
  sourcePill: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 6,
  },
  sourceText: {
    fontSize: 10.5,
    color: colors.muted,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.ink,
  },
});
