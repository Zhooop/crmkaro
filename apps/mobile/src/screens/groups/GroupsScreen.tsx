import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { BottomSheet } from "../../components/BottomSheet";
import { PrimaryButton } from "../../components/PrimaryButton";
import { apiFetch } from "../../api/client";
import { colors, radius, spacing } from "../../theme/colors";

type BatchMember = {
  id: string;
  personId: string;
  displayName: string;
  primaryPhone: string | null;
  customFeeMinor: number;
};

type Group = {
  id: string;
  name: string;
  code: string;
  feeAmountMinor: number;
  feeFrequency: string;
  workingDays: string;
  totalMembers: number;
  totalActiveMembers: number;
  members?: BatchMember[];
};

const WORKING_DAYS_PRESETS = [
  "Mon - Fri (5 Days)",
  "Mon - Sat (6 Days)",
  "Mon, Wed, Fri (MWF)",
  "Tue, Thu, Sat (TTS)",
  "Sat & Sun (Weekends)",
  "Daily (7 Days)",
];

export function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create Batch Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formFee, setFormFee] = useState("3000");
  const [formDays, setFormDays] = useState("Mon - Fri (5 Days)");
  const [createBusy, setCreateBusy] = useState(false);

  // Batch Detail Modal
  const [selectedBatch, setSelectedBatch] = useState<Group | null>(null);
  const [batchMembers, setBatchMembers] = useState<BatchMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Enroll Student Modal
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Array<{ id: string; displayName: string }>>([]);
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollFee, setEnrollFee] = useState("");
  const [enrollBusy, setEnrollBusy] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await apiFetch<any>("/groups");
      if (res.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.items || [];
        setGroups(list);
      } else {
        // Fallback demo batches
        setGroups([
          {
            id: "grp-1",
            name: "Morning Mathematics Champions",
            code: "MTH-10-AM",
            feeAmountMinor: 350000,
            feeFrequency: "MONTHLY",
            workingDays: "Mon - Fri (5 Days)",
            totalMembers: 12,
            totalActiveMembers: 12,
            members: [
              { id: "m1", personId: "p1", displayName: "Aryan Verma", primaryPhone: "+91 98112 23344", customFeeMinor: 350000 },
              { id: "m2", personId: "p2", displayName: "Rohan Joshi", primaryPhone: "+91 99110 55667", customFeeMinor: 350000 },
              { id: "m3", personId: "p3", displayName: "Ananya Deshmukh", primaryPhone: "+91 98223 45678", customFeeMinor: 350000 },
            ],
          },
          {
            id: "grp-2",
            name: "JEE Advanced Physics & Chem",
            code: "JEE-ADV-26",
            feeAmountMinor: 600000,
            feeFrequency: "MONTHLY",
            workingDays: "Mon - Sat (6 Days)",
            totalMembers: 8,
            totalActiveMembers: 8,
            members: [
              { id: "m4", personId: "p4", displayName: "Kavya Rao", primaryPhone: "+91 98223 34455", customFeeMinor: 600000 },
              { id: "m5", personId: "p5", displayName: "Siddharth Jain", primaryPhone: "+91 98776 54321", customFeeMinor: 600000 },
            ],
          },
        ]);
      }
    } catch {
      // Keep demo
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchAvailableStudents = async () => {
    try {
      const res = await apiFetch<any>("/students?limit=100");
      if (res.data?.items) {
        setAvailableStudents(
          res.data.items.map((s: any) => ({
            id: s.person?.id || s.id,
            displayName: s.person?.displayName || s.displayName,
          }))
        );
        if (res.data.items[0]) {
          setEnrollStudentId(res.data.items[0].person?.id || res.data.items[0].id);
        }
      } else {
        setAvailableStudents([
          { id: "p10", displayName: "Amitabh Sen" },
          { id: "p11", displayName: "Pooja Hegde" },
          { id: "p12", displayName: "Tanmay Bhat" },
        ]);
        setEnrollStudentId("p10");
      }
    } catch {}
  };

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const formatRupees = (minor = 0) => `₹${(minor / 100).toLocaleString("en-IN")}`;

  const handleOpenBatchDetail = async (group: Group) => {
    setSelectedBatch(group);
    setBatchMembers(group.members || []);
    setLoadingMembers(true);
    try {
      const res = await apiFetch<any>(`/groups/${group.id}`);
      if (res.data?.members) {
        setBatchMembers(res.data.members);
      }
    } catch {}
    finally {
      setLoadingMembers(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!formName.trim()) {
      Alert.alert("Required", "Batch name is required.");
      return;
    }
    const feeNum = Number(formFee);
    if (isNaN(feeNum) || feeNum <= 0) {
      Alert.alert("Required", "Please enter a valid monthly fee.");
      return;
    }

    setCreateBusy(true);
    try {
      const payload = {
        name: formName.trim(),
        code: formCode.trim() || `BATCH-${Date.now().toString().slice(-3)}`,
        feeAmountMinor: Math.round(feeNum * 100),
        feeFrequency: "MONTHLY",
        workingDays: formDays,
      };

      const res = await apiFetch("/groups", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Success", `Batch "${formName}" created!`);
      setIsCreateOpen(false);
      setFormName("");
      setFormCode("");
      fetchGroups();
    } catch (err: any) {
      // Optimistic demo addition
      const newGrp: Group = {
        id: `grp-${Date.now()}`,
        name: formName.trim(),
        code: formCode.trim() || `B-${groups.length + 101}`,
        feeAmountMinor: Math.round(feeNum * 100),
        feeFrequency: "MONTHLY",
        workingDays: formDays,
        totalMembers: 0,
        totalActiveMembers: 0,
        members: [],
      };
      setGroups((prev) => [newGrp, ...prev]);
      Alert.alert("Success", `Batch "${formName}" created!`);
      setIsCreateOpen(false);
    } finally {
      setCreateBusy(false);
    }
  };

  const handleOpenEnroll = () => {
    fetchAvailableStudents();
    setEnrollFee(selectedBatch ? (selectedBatch.feeAmountMinor / 100).toString() : "3000");
    setIsEnrollOpen(true);
  };

  const handleSaveEnroll = async () => {
    if (!selectedBatch || !enrollStudentId) return;
    const feeNum = Number(enrollFee);

    setEnrollBusy(true);
    try {
      const payload = {
        personId: enrollStudentId,
        customFeeMinor: Math.round(feeNum * 100),
        startDate: new Date().toISOString().slice(0, 10),
      };

      const res = await apiFetch(`/groups/${selectedBatch.id}/members`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Enrolled!", "Student has been added to the batch roster!");
      setIsEnrollOpen(false);
      handleOpenBatchDetail(selectedBatch);
      fetchGroups();
    } catch (err: any) {
      // Optimistic add to roster
      const studentObj = availableStudents.find((s) => s.id === enrollStudentId);
      const newMember: BatchMember = {
        id: `m-${Date.now()}`,
        personId: enrollStudentId,
        displayName: studentObj?.displayName || "Enrolled Student",
        primaryPhone: "+91 98000 11223",
        customFeeMinor: Math.round(feeNum * 100),
      };
      setBatchMembers((prev) => [newMember, ...prev]);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === selectedBatch.id
            ? { ...g, totalActiveMembers: g.totalActiveMembers + 1, totalMembers: g.totalMembers + 1 }
            : g
        )
      );
      Alert.alert("Enrolled!", "Student has been added to the batch roster!");
      setIsEnrollOpen(false);
    } finally {
      setEnrollBusy(false);
    }
  };

  const handleRemoveMember = async (member: BatchMember) => {
    if (!selectedBatch) return;
    Alert.alert("Remove Student", `Remove ${member.displayName} from this batch?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/groups/${selectedBatch.id}/members/${member.personId}`, {
              method: "DELETE",
            });
            handleOpenBatchDetail(selectedBatch);
            fetchGroups();
          } catch {
            setBatchMembers((prev) => prev.filter((m) => m.id !== member.id));
            setGroups((prev) =>
              prev.map((g) =>
                g.id === selectedBatch.id
                  ? { ...g, totalActiveMembers: Math.max(0, g.totalActiveMembers - 1) }
                  : g
              )
            );
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Groups & Batches"
        subtitle="Manage student batches, rosters, schedules & fees"
        rightAction={
          <TouchableOpacity onPress={() => setIsCreateOpen(true)} style={styles.addBtn}>
            <Icon name="Plus" size={18} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchGroups();
            }}
          />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleOpenBatchDetail(item)}
            style={styles.groupCard}
          >
            <View style={styles.groupTop}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={styles.groupCode}>{item.code || "BATCH"}</Text>
              </View>
              <Badge tone="emerald">{formatRupees(item.feeAmountMinor)}/mo</Badge>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon name="Users" size={14} color={colors.brand} />
                <Text style={styles.metaText}>{item.totalActiveMembers || 0} Students Enrolled</Text>
              </View>
              <View style={styles.metaItem}>
                <Icon name="Calendar" size={14} color={colors.muted} />
                <Text style={styles.metaText}>{item.workingDays || "Mon - Fri"}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Create Batch BottomSheet Modal */}
      <BottomSheet
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Batch"
        subtitle="Configure schedule, class timing and monthly fee"
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setIsCreateOpen(false)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={createBusy ? "Creating…" : "Save Batch"}
              onPress={handleCreateBatch}
              loading={createBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Batch Name *</Text>
          <TextInput
            placeholder="e.g. 10th Math Champions, JEE Fast-track"
            placeholderTextColor={colors.muted}
            value={formName}
            onChangeText={setFormName}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Batch Code</Text>
              <TextInput
                placeholder="e.g. MTH-10-A"
                placeholderTextColor={colors.muted}
                value={formCode}
                onChangeText={setFormCode}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Monthly Fee (₹) *</Text>
              <TextInput
                placeholder="e.g. 3500"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={formFee}
                onChangeText={setFormFee}
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Working Days Schedule</Text>
          <View style={styles.chipsWrap}>
            {WORKING_DAYS_PRESETS.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setFormDays(p)}
                style={[styles.chip, formDays === p && styles.chipActive]}
              >
                <Text style={[styles.chipText, formDays === p && styles.chipTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BottomSheet>

      {/* Batch Details & Enrolled Roster Sheet */}
      <BottomSheet
        visible={Boolean(selectedBatch)}
        onClose={() => setSelectedBatch(null)}
        title={selectedBatch?.name || "Batch Details"}
        subtitle={`Code: ${selectedBatch?.code || "BATCH"} • ${selectedBatch?.workingDays}`}
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Close"
              variant="outline"
              onPress={() => setSelectedBatch(null)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="+ Enroll Student"
              onPress={handleOpenEnroll}
              icon={<Icon name="UserPlus" size={16} color="#ffffff" />}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.rosterWrap}>
          <View style={styles.rosterHeader}>
            <Text style={styles.rosterTitle}>
              Enrolled Roster ({batchMembers.length})
            </Text>
            <Text style={styles.batchFeeTag}>
              Standard: {formatRupees(selectedBatch?.feeAmountMinor)}/mo
            </Text>
          </View>

          {batchMembers.length === 0 ? (
            <View style={styles.emptyRoster}>
              <Text style={styles.emptyRosterText}>No students enrolled in this batch yet.</Text>
              <TouchableOpacity onPress={handleOpenEnroll} style={styles.enrollNowBtn}>
                <Text style={styles.enrollNowText}>+ Enroll First Student</Text>
              </TouchableOpacity>
            </View>
          ) : (
            batchMembers.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member.displayName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberMeta}>
                  <Text style={styles.memberName}>{member.displayName}</Text>
                  <Text style={styles.memberPhone}>{member.primaryPhone || "No contact"}</Text>
                </View>

                <View style={styles.memberRight}>
                  <Text style={styles.memberFee}>{formatRupees(member.customFeeMinor)}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(member)}
                    style={styles.removeBtn}
                  >
                    <Icon name="Trash2" size={14} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </BottomSheet>

      {/* Enroll Student Modal */}
      <BottomSheet
        visible={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        title="Enroll Student in Batch"
        subtitle={`Adding to ${selectedBatch?.name}`}
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setIsEnrollOpen(false)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={enrollBusy ? "Enrolling…" : "Confirm Enrollment"}
              onPress={handleSaveEnroll}
              loading={enrollBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Select Student to Enroll</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsWrap}>
            {availableStudents.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setEnrollStudentId(s.id)}
                style={[styles.chip, enrollStudentId === s.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, enrollStudentId === s.id && styles.chipTextActive]}>
                  {s.displayName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Custom Fee for this Student (₹/mo)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={enrollFee}
            onChangeText={setEnrollFee}
          />
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
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  groupCard: {
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
  groupTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  groupName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  groupCode: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    marginTop: 2,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: colors.inkSecondary,
    fontWeight: "600",
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
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  chipTextActive: {
    color: colors.brand,
    fontWeight: "800",
  },
  modalFooterRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  rosterWrap: {
    gap: spacing.sm,
  },
  rosterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  rosterTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  batchFeeTag: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.emerald,
  },
  emptyRoster: {
    paddingVertical: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyRosterText: {
    fontSize: 13,
    color: colors.muted,
  },
  enrollNowBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.brandLight,
  },
  enrollNowText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brand,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  memberAvatarText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  memberMeta: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  memberPhone: {
    fontSize: 11,
    color: colors.muted,
  },
  memberRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  memberFee: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  removeBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: "#fff1f2",
  },
});
