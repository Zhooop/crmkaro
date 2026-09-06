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
        {/* Executive Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroPill}>
            <View style={styles.pulseDot} />
            <Text style={styles.heroPillText}>Live Operational Dashboard</Text>
          </View>
          <Text style={styles.heroTitle}>Workspace Pulse</Text>
          <Text style={styles.heroSubtitle}>
            Real-time billing, admissions and student pipeline metrics.
          </Text>
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

        {/* Fast Action Launcher */}
        <Text style={styles.sectionHeader}>Quick Actions</Text>
        <View style={styles.quickActionRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("QuickCollect")}
            style={[styles.quickBtn, { backgroundColor: colors.emeraldLight, borderColor: colors.emeraldBorder }]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: colors.emerald }]}>
              <Icon name="Zap" size={18} color="#ffffff" />
            </View>
            <Text style={[styles.quickLabel, { color: colors.emerald }]}>Quick Collect</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("People")}
            style={[styles.quickBtn, { backgroundColor: colors.brandLight, borderColor: "#bfdbfe" }]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: colors.brand }]}>
              <Icon name="UserPlus" size={18} color="#ffffff" />
            </View>
            <Text style={[styles.quickLabel, { color: colors.brand }]}>Add Member</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Finance")}
            style={[styles.quickBtn, { backgroundColor: "#fff7ed", borderColor: "#fed7aa" }]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: "#ea580c" }]}>
              <Icon name="FileText" size={18} color="#ffffff" />
            </View>
            <Text style={[styles.quickLabel, { color: "#ea580c" }]}>New Bill</Text>
          </TouchableOpacity>
        </View>

        {/* Live Workspace Activity */}
        <View style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <View style={styles.activityTitleRow}>
              <Icon name="Activity" size={16} color={colors.brand} />
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
    marginRight: 6,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
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
  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  quickActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
  },
  quickIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  quickLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineLight,
  },
  activityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  activityTitle: {
    fontSize: 13.5,
    fontWeight: "700",
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
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  activityDotIcon: {
    fontSize: 14,
  },
  activityMeta: {
    flex: 1,
  },
  activitySummary: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 18,
  },
  activityTime: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  notificationsContainer: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  notifWarning: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  notifInfo: {
    backgroundColor: colors.brandLight,
    borderColor: "#bfdbfe",
  },
  notifTextWrap: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  notifDetail: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
  emptyActivityBox: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyActivityTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 4,
  },
  emptyActivitySubtitle: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 17,
  },
});
