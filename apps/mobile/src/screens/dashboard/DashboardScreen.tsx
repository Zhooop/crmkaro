import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppHeader } from "../../components/AppHeader";
import { StatCard } from "../../components/StatCard";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { apiFetch } from "../../api/client";
import { colors, radius, spacing } from "../../theme/colors";

type DashboardData = {
  organisation: {
    id: string;
    name: string;
    currency: string;
    businessType?: string;
  };
  cards: Array<{
    key: string;
    label: string;
    value: number;
    detail: string;
    format: "number" | "money";
    tone?: "blue" | "emerald" | "amber" | "rose" | "purple" | "teal";
  }>;
  notifications?: Array<{
    id: string;
    module: string;
    title: string;
    detail: string;
    severity: "info" | "warning" | "critical";
    actionLabel?: string;
    actionHref?: string;
  }>;
  transactions?: Array<{
    id: string;
    receiptNumber: string;
    personName: string;
    invoiceNumber: string;
    amountMinor: number;
    method: string;
    receivedAt: string;
  }>;
  activity?: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    metadata?: any;
  }>;
};

function humanizeAction(action: string): string {
  switch (action) {
    case "student.admitted":
      return "Student Admitted";
    case "student.fee_paid":
      return "Fee Payment Collected";
    case "student.updated":
      return "Student Profile Updated";
    case "attendance.batch_recorded":
      return "Daily Attendance Marked";
    case "person.created":
      return "New Contact Added";
    case "person.archived":
      return "Contact Archived";
    case "lead.created":
      return "New Lead Created";
    case "invoice.created":
      return "Invoice Issued";
    case "payment.created":
    case "payment.recorded":
      return "Payment Recorded";
    case "inventory.product_created":
      return "Product Added to Catalog";
    case "payroll.run_created":
      return "Monthly Payroll Created";
    case "organisation.created":
      return "Workspace Configured";
    default:
      return action.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await apiFetch<DashboardData>("/dashboard");
      if (res.data) {
        setDashboard(res.data);
      }
    } catch {
      // Empty/Error state without dummy data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const formatRupees = (minor = 0) => {
    return `₹${(minor / 100).toLocaleString("en-IN")}`;
  };

  const totalReceivedCard = dashboard?.cards?.find(
    (c) =>
      c.key === "total_received" ||
      c.key === "revenue" ||
      c.label.toLowerCase().includes("revenue") ||
      c.label.toLowerCase().includes("collected")
  );
  const openLeadsCard = dashboard?.cards?.find(
    (c) =>
      c.key.includes("lead") ||
      c.key.includes("crm") ||
      c.label.toLowerCase().includes("lead")
  );
  const pendingDuesCard = dashboard?.cards?.find(
    (c) => c.key === "total_due" || c.label.toLowerCase().includes("due")
  );

  const handleCardPress = (cardKey: string) => {
    if (cardKey === "total_members") navigation.navigate("People");
    else if (cardKey === "total_received" || cardKey === "total_due") navigation.navigate("Finance");
    else if (cardKey === "active_groups") navigation.navigate("Groups");
    else if (cardKey.startsWith("students")) navigation.navigate("Students");
    else if (cardKey.includes("lead") || cardKey.includes("crm")) navigation.navigate("CRM");
  };

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Executive Hero Banner - Vibrant Royal Gradient Style */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroPill}>
              <View style={styles.pulseDot} />
              <Text style={styles.heroPillText}>LIVE WORKSPACE</Text>
            </View>
            <Text style={styles.heroBrandMark}>CRMKARO</Text>
          </View>
          
          <Text style={styles.heroTitle}>Workspace Pulse</Text>
          <Text style={styles.heroSubtitle}>
            Real-time billing, admissions, and student pipeline metrics.
          </Text>

          {/* Frosted Mini Highlights */}
          <View style={styles.heroHighlights}>
            <View style={styles.heroHighlightItem}>
              <Text style={styles.heroHighlightLabel}>TOTAL COLLECTED</Text>
              <Text style={styles.heroHighlightValue}>
                {totalReceivedCard ? formatRupees(totalReceivedCard.value) : "₹0"}
              </Text>
            </View>
            <View style={styles.heroHighlightDivider} />
            <View style={styles.heroHighlightItem}>
              <Text style={styles.heroHighlightLabel}>
                {pendingDuesCard && pendingDuesCard.value > 0 ? "PENDING DUES" : "ACTIVE PIPELINE"}
              </Text>
              <Text style={styles.heroHighlightValue}>
                {pendingDuesCard && pendingDuesCard.value > 0
                  ? formatRupees(pendingDuesCard.value)
                  : openLeadsCard
                    ? `${openLeadsCard.value} Inquiries`
                    : "0 Inquiries"}
              </Text>
            </View>
          </View>
        </View>

        {/* Notifications / Pending Alerts */}
        {dashboard?.notifications && dashboard.notifications.length > 0 && (
          <View style={styles.notificationsContainer}>
            {dashboard.notifications.map((notif) => (
              <View
                key={notif.id}
                style={[
                  styles.notifCard,
                  notif.severity === "warning" ? styles.notifWarning : styles.notifInfo,
                ]}
              >
                <Icon
                  name={notif.severity === "warning" ? "AlertCircle" : "Info"}
                  size={18}
                  color={notif.severity === "warning" ? "#d97706" : colors.brand}
                />
                <View style={styles.notifTextWrap}>
                  <Text style={styles.notifTitle}>{notif.title}</Text>
                  <Text style={styles.notifDetail}>{notif.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Section Title */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Key Performance Indicators</Text>
          <Text style={styles.sectionMeta}>Updated live</Text>
        </View>

        {/* Dynamic KPI Cards Grid */}
        {dashboard?.cards && dashboard.cards.length > 0 ? (
          <View style={styles.statsGrid}>
            {dashboard.cards.map((card, index) => (
              <View key={card.key || index} style={styles.statCol}>
                <StatCard
                  label={card.label}
                  value={
                    card.format === "money"
                      ? formatRupees(card.value)
                      : Number(card.value || 0).toLocaleString("en-IN")
                  }
                  change={card.detail}
                  tone={card.tone || "blue"}
                  onPress={() => handleCardPress(card.key)}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={styles.statCol}>
              <StatCard
                label="Revenue"
                value="₹0"
                change="No payments recorded"
                tone="emerald"
                onPress={() => navigation.navigate("Finance")}
              />
            </View>
            <View style={styles.statCol}>
              <StatCard
                label="Members"
                value="0"
                change="No members enrolled"
                tone="blue"
                onPress={() => navigation.navigate("People")}
              />
            </View>
            <View style={styles.statCol}>
              <StatCard
                label="Pending Dues"
                value="₹0"
                change="All dues cleared"
                tone="teal"
                onPress={() => navigation.navigate("Finance")}
              />
            </View>
            <View style={styles.statCol}>
              <StatCard
                label="Open Leads"
                value="0"
                change="No active inquiries"
                tone="amber"
                onPress={() => navigation.navigate("CRM")}
              />
            </View>
          </View>
        )}

        {/* Fast Action Launcher - 4 Squircle Actions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Quick Actions</Text>
          <Text style={styles.sectionMeta}>Frequent shortcuts</Text>
        </View>

        <View style={styles.quickGrid}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("QuickCollect")}
            style={[styles.quickCard, { backgroundColor: colors.emeraldLight, borderColor: colors.emeraldBorder }]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: colors.emerald }]}>
              <Icon name="Zap" size={20} color="#ffffff" />
            </View>
            <Text style={[styles.quickCardTitle, { color: "#065f46" }]}>Quick Collect</Text>
            <Text style={[styles.quickCardSub, { color: "#047857" }]}>Fast WhatsApp pay</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("People")}
            style={[styles.quickCard, { backgroundColor: colors.brandLight, borderColor: colors.brandBorder }]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: colors.brandVibrant }]}>
              <Icon name="UserPlus" size={20} color="#ffffff" />
            </View>
            <Text style={[styles.quickCardTitle, { color: "#1e40af" }]}>Add Member</Text>
            <Text style={[styles.quickCardSub, { color: "#2563eb" }]}>Enroll new contact</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Finance")}
            style={[styles.quickCard, { backgroundColor: "#fff7ed", borderColor: "#fed7aa" }]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: "#ea580c" }]}>
              <Icon name="FileText" size={20} color="#ffffff" />
            </View>
            <Text style={[styles.quickCardTitle, { color: "#9a3412" }]}>New Bill</Text>
            <Text style={[styles.quickCardSub, { color: "#c2410c" }]}>Generate invoice</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("CRM")}
            style={[styles.quickCard, { backgroundColor: "#f5f3ff", borderColor: "#ddd6fe" }]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: "#7c3aed" }]}>
              <Icon name="Users" size={20} color="#ffffff" />
            </View>
            <Text style={[styles.quickCardTitle, { color: "#5b21b6" }]}>Leads CRM</Text>
            <Text style={[styles.quickCardSub, { color: "#6d28d9" }]}>Track inquiries</Text>
          </TouchableOpacity>
        </View>

        {/* Live Workspace Activity */}
        <View style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <View style={styles.activityTitleRow}>
              <View style={styles.activityIconCircle}>
                <Icon name="Activity" size={16} color={colors.brandVibrant} />
              </View>
              <Text style={styles.activityTitle}>Live Workspace Activity</Text>
            </View>
            <Badge tone="blue">Real-time</Badge>
          </View>

          <View style={styles.activityList}>
            {dashboard?.activity && dashboard.activity.length > 0 ? (
              dashboard.activity.map((act, index) => (
                <View
                  key={act.id}
                  style={[
                    styles.activityItem,
                    index !== (dashboard.activity?.length ?? 1) - 1 && styles.activityItemBorder,
                  ]}
                >
                  <View style={styles.activityDot}>
                    <Text style={styles.activityDotIcon}>⚡</Text>
                  </View>
                  <View style={styles.activityMeta}>
                    <Text style={styles.activitySummary}>{humanizeAction(act.action)}</Text>
                    <Text style={styles.activityTime}>
                      {(act.entityType || "").replace(/_/g, " ")} • {formatRelativeTime(act.createdAt)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyActivityBox}>
                <View style={styles.emptyIconWrap}>
                  <Icon name="Activity" size={24} color={colors.subtle} />
                </View>
                <Text style={styles.emptyActivityTitle}>No recent activity</Text>
                <Text style={styles.emptyActivitySubtitle}>
                  New workspace events, admissions and payments will stream here in real time.
                </Text>
              </View>
            )}
          </View>
        </View>
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
  heroBanner: {
    backgroundColor: colors.brandDeep,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.emeraldVibrant,
    marginRight: 6,
  },
  heroPillText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#6ee7b7",
    letterSpacing: 0.6,
  },
  heroBrandMark: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(255, 255, 255, 0.4)",
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#bfdbfe",
    marginTop: 4,
    lineHeight: 18,
    fontWeight: "500",
  },
  heroHighlights: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  heroHighlightItem: {
    flex: 1,
  },
  heroHighlightDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    marginHorizontal: spacing.md,
  },
  heroHighlightLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#93c5fd",
    letterSpacing: 0.6,
  },
  heroHighlightValue: {
    fontSize: 17,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.inkSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.lg,
  },
  statCol: {
    width: "50%",
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.xl,
  },
  quickCard: {
    width: "47.5%",
    marginHorizontal: "1.25%",
    borderRadius: radius.xl,
    borderWidth: 1.5,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm + 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2.5,
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  quickCardTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    textAlign: "center",
  },
  quickCardSub: {
    fontSize: 10.5,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineLight,
  },
  activityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  activityIconCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  activityList: {
    paddingHorizontal: spacing.md,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lineLight,
  },
  activityDot: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  activityDotIcon: {
    fontSize: 15,
  },
  activityMeta: {
    flex: 1,
  },
  activitySummary: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 18,
  },
  activityTime: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
    fontWeight: "500",
  },
  notificationsContainer: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  notifWarning: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  notifInfo: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brandBorder,
  },
  notifTextWrap: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  notifDetail: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
  emptyActivityBox: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyActivityTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 4,
  },
  emptyActivitySubtitle: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 260,
  },
});
