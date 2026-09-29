import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { Icon } from "./Icon";
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
          <View style={styles.brandIconWrap}>
            <Image
              source={require("../../assets/crmkaro-mark.png")}
              style={styles.brandIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.tenantMeta}>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandName}>CRMKARO</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={styles.orgName}>
              {orgName}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.rightActions}>
          {rightAction}
          
          <TouchableOpacity activeOpacity={0.7} style={styles.iconButton}>
            <Icon name="Bell" size={19} color={colors.inkSecondary} />
            <View style={styles.badgeIndicator} />
          </TouchableOpacity>

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
    paddingBottom: spacing.md + 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
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
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.brandBorder,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  brandIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    overflow: "hidden",
  },
  brandIcon: {
    width: 26,
    height: 26,
  },
  tenantMeta: {
    flexShrink: 1,
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  brandName: {
    fontSize: 9.5,
    fontWeight: "900",
    color: colors.brand,
    letterSpacing: 0.8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.pill,
    gap: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.emerald,
  },
  liveText: {
    fontSize: 8.5,
    fontWeight: "800",
    color: colors.emerald,
    letterSpacing: 0.3,
  },
  orgName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 1,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badgeIndicator: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#ffffff",
  },
  titleContainer: {
    marginTop: spacing.md,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
    fontWeight: "500",
  },
});
