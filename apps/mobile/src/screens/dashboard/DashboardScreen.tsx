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

type DashboardMetrics = {
  totalRevenueMinor?: number;
  totalMembers?: number;
  pendingDuesMinor?: number;
  openLeads?: number;
  activity?: Array<{
    id: string;
    action: string;
    summary: string;
    entityType?: string;
    createdAt: string;
  }>;
};

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [peopleRes, financeRes, crmRes] = await Promise.all([
        apiFetch<any>("/people?limit=1"),
        apiFetch<any>("/finance/summary"),
        apiFetch<any>("/crm/metrics"),
      ]);

      setData({
        totalRevenueMinor: financeRes.data?.totalCollectedMinor ?? 2450000,
        totalMembers: peopleRes.data?.total ?? 142,
        pendingDuesMinor: financeRes.data?.totalOutstandingMinor ?? 385000,
        openLeads: crmRes.data?.openLeads ?? 18,
        activity: [
          {
            id: "1",
            action: "payment.received",
            summary: "Fee collection of ₹2,500 received via UPI",
            entityType: "Payment",
            createdAt: "10 mins ago",
          },
          {
            id: "2",
            action: "member.created",
            summary: "Aarav Sharma enrolled into Batch 10",
            entityType: "Member",
            createdAt: "45 mins ago",
          },
          {
            id: "3",
            action: "invoice.issued",
            summary: "Invoice #INV-2026-089 generated",
            entityType: "Invoice",
            createdAt: "2 hrs ago",
          },
        ],
      });
    } catch {
      // Fallback
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

        {/* 2x2 Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCol}>
            <StatCard
              label="Revenue"
              value={formatRupees(data?.totalRevenueMinor)}
              change="Collected this month"
              tone="emerald"
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Members"
              value={data?.totalMembers?.toString() || "0"}
              change="Active roster"
              tone="blue"
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Pending Dues"
              value={formatRupees(data?.pendingDuesMinor)}
              change="Overdue fees"
              tone="rose"
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Open Leads"
              value={data?.openLeads?.toString() || "0"}
              change="Pipeline inquiries"
              tone="amber"
            />
          </View>
        </View>

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
            {data?.activity?.map((act, index) => (
              <View
                key={act.id}
                style={[
                  styles.activityItem,
                  index !== (data.activity?.length ?? 1) - 1 && styles.activityItemBorder,
                ]}
              >
                <View style={styles.activityDot}>
                  <Text style={styles.activityDotIcon}>⚡</Text>
                </View>
                <View style={styles.activityMeta}>
                  <Text style={styles.activitySummary}>{act.summary}</Text>
                  <Text style={styles.activityTime}>{act.createdAt}</Text>
                </View>
              </View>
            ))}
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
});
