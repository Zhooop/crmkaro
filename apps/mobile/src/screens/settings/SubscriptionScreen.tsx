import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { StatCard } from "../../components/StatCard";
import { Icon } from "../../components/Icon";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";

export function SubscriptionScreen() {
  const { activeOrg } = useAuth();
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubscription = async () => {
    try {
      const res = await apiFetch<any>("/subscriptions/current");
      if (res.data) {
        setSubData(res.data.subscription || res.data);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubscription();
  };

  const periodEndFormatted = subData?.currentPeriodEnd
    ? new Date(subData.currentPeriodEnd).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Monthly Renewal";

  const INCLUDED_FEATURES = [
    "Unlimited Students, Members & Profiles",
    "1-Click WhatsApp PDF Receipts & Invoices",
    "Daily Batch Attendance & Parent Alerts",
    "Staff Salary Structures & Payslips",
    "GST Invoicing & Daily Kharcha Tracker",
    "Sales CRM Pipelines & Follow-up Reminders",
    "Single-Tap Mobile Web & App Access",
    "Automatic Monthly Renewal via UPI & Cards",
  ];

  return (
    <View style={styles.container}>
      <AppHeader
        title="Subscription & Billing"
        subtitle="Manage business plan & active auto-renewal"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Top KPI Cards Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCol}>
            <StatCard
              label="Current Plan"
              value="Launch Offer"
              change="All-in-One OS"
              tone="blue"
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Monthly Price"
              value="₹249/mo"
              change="76% Launch Rate"
              tone="emerald"
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Plan Status"
              value="ACTIVE 🟢"
              change="All Unlocked"
              tone="emerald"
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Billing Period"
              value={periodEndFormatted}
              change="Auto renewal"
              tone="teal"
            />
          </View>
        </View>

        {/* ACTIVE PLAN & WORKSPACE ACCESS CARD */}
        <View style={styles.planCard}>
          {/* Plan Header */}
          <View style={styles.planHeadRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.activeBadgeRow}>
                <View style={styles.activeDot} />
                <Text style={styles.activeBadgeText}>ACTIVE PLAN</Text>
                <Text style={styles.renewalText}>Monthly Auto-Renewal</Text>
              </View>
              <Text style={styles.planTitle}>
                Launch Offer — All-in-One Business OS
              </Text>
              <Text style={styles.planSubtitle}>
                Full access to student batches, daily attendance, staff payroll, sales CRM, and 1-click invoicing.
              </Text>
            </View>

            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Plan Price</Text>
              <Text style={styles.priceValue}>₹249<Text style={styles.priceMonth}>/mo</Text></Text>
              <Text style={styles.priceTag}>✓ Launch Rate</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Included Features */}
          <Text style={styles.featuresHeading}>
            INCLUDED FEATURES & WORKSPACE ACCESS
          </Text>

          <View style={styles.featuresList}>
            {INCLUDED_FEATURES.map((feat, idx) => (
              <View key={idx} style={styles.featureItem}>
                <View style={styles.checkWrap}>
                  <Icon name="Check" size={13} color="#10b981" />
                </View>
                <Text style={styles.featureText}>{feat}</Text>
              </View>
            ))}
          </View>

          {/* Status Footer Banner */}
          <View style={styles.footerBanner}>
            <View style={styles.footerBannerLeft}>
              <Text style={{ fontSize: 13 }}>🟢</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.footerBannerTitle}>
                  Workspace Subscription is Active
                </Text>
                <Text style={styles.footerBannerSub}>
                  All business modules and CRM tools are fully unlocked.
                </Text>
              </View>
            </View>
            <View style={styles.footerBadge}>
              <Text style={styles.footerBadgeText}>
                ✓ Active (₹249/mo)
              </Text>
            </View>
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
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statCol: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: "#10b981",
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  planHeadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  activeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  activeBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#059669",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  renewalText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
  },
  planTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 2,
  },
  planSubtitle: {
    fontSize: 11.5,
    color: colors.muted,
    lineHeight: 16,
    marginTop: 2,
  },
  priceBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: "600",
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.ink,
  },
  priceMonth: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  priceTag: {
    fontSize: 10,
    color: "#059669",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 4,
  },
  featuresHeading: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  featuresList: {
    gap: 8,
    marginVertical: 2,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 11.5,
    color: colors.ink,
    fontWeight: "500",
    flex: 1,
  },
  footerBanner: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    marginTop: 6,
  },
  footerBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065f46",
  },
  footerBannerSub: {
    fontSize: 10.5,
    color: "#047857",
  },
  footerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  footerBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#065f46",
  },
});
