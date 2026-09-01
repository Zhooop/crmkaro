import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";

export function SettingsScreen() {
  const { user, activeOrg, logout, organisations, switchOrganisation } = useAuth();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out from CRMKaro?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Workspace Settings" subtitle="System Configuration & Account" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Workspace Profile Card */}
        <View style={styles.profileHero}>
          <View style={styles.avatarLg}>
            <Text style={styles.avatarLgText}>
              {activeOrg?.name ? activeOrg.name.slice(0, 2).toUpperCase() : "CK"}
            </Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.orgName}>{activeOrg?.name || "CRMKaro Workspace"}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={{ marginTop: 4 }}>
              <Badge tone="blue">{user?.role || "Workspace Owner"}</Badge>
            </View>
          </View>
        </View>

        {/* Switch Workspace */}
        {organisations.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Switch Organisation</Text>
            {organisations.map((org) => (
              <TouchableOpacity
                key={org.id}
                onPress={() => switchOrganisation(org)}
                style={[
                  styles.orgRow,
                  activeOrg?.id === org.id && styles.orgRowActive,
                ]}
              >
                <Icon name="Building" size={16} color={activeOrg?.id === org.id ? colors.brand : colors.muted} />
                <Text
                  style={[
                    styles.orgRowText,
                    activeOrg?.id === org.id && styles.orgRowTextActive,
                  ]}
                >
                  {org.name}
                </Text>
                {activeOrg?.id === org.id && <Badge tone="blue">Active</Badge>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Account Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account & Security</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>User ID</Text>
            <Text style={styles.infoVal}>{user?.id?.slice(0, 8)}...</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Data Isolation</Text>
            <Text style={styles.infoVal}>Tenant PostgreSQL (RLS)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>App Version</Text>
            <Text style={styles.infoVal}>v1.0.0 (Expo React Native)</Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <PrimaryButton
          title="Sign Out from CRMKaro"
          onPress={handleLogout}
          variant="danger"
          icon={<Icon name="LogOut" size={16} color={colors.danger} />}
          style={{ marginTop: spacing.lg }}
        />
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
  profileHero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  avatarLg: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarLgText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.brand,
  },
  profileMeta: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
  },
  userEmail: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 1,
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
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: spacing.md,
  },
  orgRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineLight,
    gap: spacing.sm,
  },
  orgRowActive: {
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  orgRowText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.ink,
  },
  orgRowTextActive: {
    color: colors.brand,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  infoKey: {
    fontSize: 12.5,
    color: colors.muted,
  },
  infoVal: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.ink,
  },
});
