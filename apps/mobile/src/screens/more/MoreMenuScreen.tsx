import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { Icon, IconName } from "../../components/Icon";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";

type ModuleItem = {
  id: string;
  title: string;
  subtitle: string;
  iconName: IconName;
  iconColor: string;
  route: string;
  bg: string;
};

export function MoreMenuScreen() {
  const navigation = useNavigation<any>();
  const { user, activeOrg, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out from CRMKaro?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  const modules: ModuleItem[] = [
    {
      id: "students",
      title: "Students & Academy",
      subtitle: "Roll numbers, standards & daily attendance",
      iconName: "GraduationCap",
      iconColor: colors.brand,
      route: "Students",
      bg: colors.brandLight,
    },
    {
      id: "groups",
      title: "Groups & Batches",
      subtitle: "Batch rosters, schedules & fees",
      iconName: "Users",
      iconColor: colors.emerald,
      route: "Groups",
      bg: colors.emeraldLight,
    },
    {
      id: "crm",
      title: "Leads & CRM Pipeline",
      subtitle: "Deals kanban, follow-up calls & inquiries",
      iconName: "TrendingUp",
      iconColor: "#ea580c",
      route: "CRM",
      bg: "#fff7ed",
    },
    {
      id: "transactions",
      title: "Transactions & Receipts",
      subtitle: "Payment ledger, verified receipts & billing",
      iconName: "Receipt",
      iconColor: colors.emerald,
      route: "Transactions",
      bg: colors.emeraldLight,
    },
    {
      id: "inventory",
      title: "Inventory & Catalog",
      subtitle: "Stock levels, books, uniforms & reorder alerts",
      iconName: "Package",
      iconColor: "#8b5cf6",
      route: "Inventory",
      bg: "#f3e8ff",
    },
    {
      id: "payroll",
      title: "Payroll & Staff",
      subtitle: "Employee roster, salary CTC & payroll runs",
      iconName: "DollarSign",
      iconColor: "#0284c7",
      route: "Payroll",
      bg: "#e0f2fe",
    },
    {
      id: "settings",
      title: "Workspace Settings",
      subtitle: "Branding, team staff & organization security",
      iconName: "Settings",
      iconColor: colors.ink,
      route: "Settings",
      bg: colors.surfaceMuted,
    },
  ];

  return (
    <View style={styles.container}>
      <AppHeader title="All Modules" subtitle="Complete CRMKaro Service Suite" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile & Active Workspace Header */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(user?.name || activeOrg?.name || "U").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileMeta}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.profileName}>{user?.name || "Workspace User"}</Text>
              <Badge tone="blue">Admin</Badge>
            </View>
            <Text style={styles.profileOrg}>
              🏢 {activeOrg?.name || "CRMKaro Business OS"}
            </Text>
            <Text style={styles.profileEmail}>{user?.email || "Signed in"}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            style={styles.settingsIconBtn}
          >
            <Icon name="Settings" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeading}>Business Modules</Text>

        {modules.map((m) => (
          <TouchableOpacity
            key={m.id}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(m.route)}
            style={styles.moduleCard}
          >
            <View style={[styles.iconWrap, { backgroundColor: m.bg }]}>
              <Icon name={m.iconName} size={20} color={m.iconColor} />
            </View>
            <View style={styles.meta}>
              <Text style={styles.title}>{m.title}</Text>
              <Text style={styles.subtitle}>{m.subtitle}</Text>
            </View>
            <Icon name="ChevronRight" size={18} color={colors.subtle} />
          </TouchableOpacity>
        ))}

        {/* Quick Sign Out Action */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleLogout}
          style={styles.logoutBtn}
        >
          <Icon name="LogOut" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Sign Out from Workspace</Text>
        </TouchableOpacity>
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
    gap: spacing.sm,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.xs,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brand,
  },
  profileMeta: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.ink,
  },
  profileOrg: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.brandNavy,
  },
  profileEmail: {
    fontSize: 11,
    color: colors.muted,
  },
  settingsIconBtn: {
    padding: 8,
  },
  sectionHeading: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  moduleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  meta: {
    flex: 1,
  },
  title: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: radius.xl,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  logoutText: {
    fontSize: 13.5,
    fontWeight: "750",
    color: colors.danger,
  },
});
