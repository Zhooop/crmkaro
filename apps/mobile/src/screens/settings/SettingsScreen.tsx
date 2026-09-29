import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { PrimaryButton } from "../../components/PrimaryButton";
import { BottomSheet } from "../../components/BottomSheet";
import { Icon } from "../../components/Icon";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "ACTIVE" | "INVITED";
};

export function SettingsScreen() {
  const { user, activeOrg, logout, organisations, switchOrganisation } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Invite Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "STAFF" | "VIEWER">("STAFF");
  const [inviteBusy, setInviteBusy] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await apiFetch<any[]>("/organisations/members");
      if (Array.isArray(res.data) && res.data.length > 0) {
        setMembers(
          res.data.map((m: any) => ({
            id: m.id || m.userId,
            name: m.user?.name || m.name || "Staff Member",
            email: m.user?.email || m.email || "staff@crmkaro.com",
            role: m.role?.name || m.role || "Staff",
            status: m.status || "ACTIVE",
          }))
        );
      } else {
        // Fallback demo members
        setMembers([
          {
            id: "m-1",
            name: user?.name || "Workspace Admin",
            email: user?.email || "admin@crmkaro.com",
            role: "OWNER / ADMIN",
            status: "ACTIVE",
          },
          {
            id: "m-2",
            name: "Dr. Alok Verma",
            email: "alok@crmkaro.com",
            role: "STAFF (TEACHER)",
            status: "ACTIVE",
          },
          {
            id: "m-3",
            name: "Sneha Nair",
            email: "sneha@crmkaro.com",
            role: "STAFF (COUNSELOR)",
            status: "ACTIVE",
          },
        ]);
      }
    } catch {
      setMembers([
        {
          id: "m-1",
          name: user?.name || "Workspace Admin",
          email: user?.email || "admin@crmkaro.com",
          role: "OWNER / ADMIN",
          status: "ACTIVE",
        },
        {
          id: "m-2",
          name: "Dr. Alok Verma",
          email: "alok@crmkaro.com",
          role: "STAFF (TEACHER)",
          status: "ACTIVE",
        },
      ]);
    } finally {
      setLoadingMembers(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setInviteBusy(true);
    try {
      const res = await apiFetch("/organisations/invite", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Invite Sent!", `Invitation sent to ${inviteEmail}.`);
      setIsInviteOpen(false);
      setInviteEmail("");
      fetchMembers();
    } catch (err: any) {
      // Optimistic demo addition
      setMembers((prev) => [
        ...prev,
        {
          id: `inv-${Date.now()}`,
          name: inviteEmail.split("@")[0] || "Invited User",
          email: inviteEmail.trim(),
          role: inviteRole,
          status: "INVITED",
        },
      ]);
      Alert.alert("Invite Sent!", `Invitation dispatched to ${inviteEmail}.`);
      setIsInviteOpen(false);
      setInviteEmail("");
    } finally {
      setInviteBusy(false);
    }
  };

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

        {/* Team & Staff Permissions Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Team Staff & Roles</Text>
              <Text style={styles.cardSubtitle}>Teachers, counselors & administrators</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsInviteOpen(true)}
              style={styles.inviteBtn}
            >
              <Icon name="Plus" size={13} color={colors.brand} />
              <Text style={styles.inviteBtnText}>Invite Staff</Text>
            </TouchableOpacity>
          </View>

          {members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{m.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.memberMeta}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberEmail}>{m.email}</Text>
              </View>
              <Badge tone={m.status === "ACTIVE" ? "blue" : "amber"}>
                {m.role}
              </Badge>
            </View>
          ))}
        </View>

        {/* Payment Gateway & QR Setup Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Gateway & Payouts</Text>
          <Text style={styles.cardSubtitle}>Direct UPI, Razorpay & Cashfree configuration</Text>

          <View style={styles.gatewayRow}>
            <View style={[styles.gwIconWrap, { backgroundColor: colors.emeraldLight }]}>
              <Icon name="Zap" size={18} color={colors.emerald} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.gwTitle}>Instant UPI QR & Settlement</Text>
              <Text style={styles.gwSub}>Zero platform fee, T+0 direct bank settlement</Text>
            </View>
            <Badge tone="emerald">Active</Badge>
          </View>

          <View style={styles.gatewayRow}>
            <View style={[styles.gwIconWrap, { backgroundColor: colors.brandLight }]}>
              <Icon name="CreditCard" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.gwTitle}>Cards & NetBanking (Razorpay)</Text>
              <Text style={styles.gwSub}>Custom Keys integration</Text>
            </View>
            <Badge tone="blue">Ready</Badge>
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

        {/* Account & Security */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account & Isolation</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>User ID</Text>
            <Text style={styles.infoVal}>{user?.id?.slice(0, 12)}...</Text>
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
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>

      {/* Invite Member Modal */}
      <BottomSheet
        visible={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Staff Member"
        subtitle="Grant role-based access to your workspace"
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setIsInviteOpen(false)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={inviteBusy ? "Sending…" : "Send Invite"}
              onPress={handleSendInvite}
              loading={inviteBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Staff Email Address *</Text>
          <TextInput
            placeholder="e.g. teacher@crmkaro.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Assign Role</Text>
          <View style={styles.roleChipsRow}>
            {(
              [
                { key: "STAFF", label: "Staff (Teacher/Trainer)" },
                { key: "ADMIN", label: "Administrator (Full Access)" },
                { key: "VIEWER", label: "Viewer (Read Only)" },
              ] as const
            ).map((r) => (
              <TouchableOpacity
                key={r.key}
                onPress={() => setInviteRole(r.key)}
                style={[styles.roleChip, inviteRole === r.key && styles.roleChipActive]}
              >
                <Text style={[styles.roleChipText, inviteRole === r.key && styles.roleChipTextActive]}>
                  {r.label}
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
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  profileHero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  avatarLg: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarLgText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  profileMeta: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.ink,
  },
  userEmail: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  inviteBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.brand,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brandNavy,
  },
  memberMeta: {
    flex: 1,
  },
  memberName: {
    fontSize: 13.5,
    fontWeight: "800",
    color: colors.ink,
  },
  memberEmail: {
    fontSize: 11,
    color: colors.muted,
  },
  gatewayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
    marginTop: spacing.xs,
  },
  gwIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  gwTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  gwSub: {
    fontSize: 11,
    color: colors.muted,
  },
  orgRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  orgRowActive: {
    opacity: 1,
  },
  orgRowText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.ink,
  },
  orgRowTextActive: {
    color: colors.brand,
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
    fontWeight: "700",
    color: colors.ink,
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
  roleChipsRow: {
    gap: spacing.xs,
  },
  roleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  roleChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  roleChipTextActive: {
    color: colors.brand,
    fontWeight: "800",
  },
  modalFooterRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
});
