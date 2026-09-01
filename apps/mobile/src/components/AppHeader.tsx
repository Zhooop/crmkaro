import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing } from "../theme/colors";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  onTenantPress?: () => void;
};

export function AppHeader({ title, subtitle, rightAction, onTenantPress }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { activeOrg, user } = useAuth();

  const orgName = activeOrg?.name || "CRMKaro Workspace";
  const userInitial = user?.name ? user.name.slice(0, 1).toUpperCase() : "U";

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onTenantPress}
          style={styles.tenantPill}
        >
          <View style={styles.brandIcon}>
            <Text style={styles.brandIconText}>⚡</Text>
          </View>
          <View style={styles.tenantMeta}>
            <Text style={styles.brandName}>CRMKaro</Text>
            <Text numberOfLines={1} style={styles.orgName}>
              {orgName}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.rightActions}>
          {rightAction}
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{userInitial}</Text>
          </View>
        </View>
      </View>

      {Boolean(title) && (
        <View style={styles.titleContainer}>
          <Text style={styles.pageTitle}>{title}</Text>
          {Boolean(subtitle) && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tenantPill: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "70%",
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  brandIconText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  tenantMeta: {
    flexShrink: 1,
  },
  brandName: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  orgName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.ink,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.brand,
  },
  titleContainer: {
    marginTop: spacing.md,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
});
