import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { SearchInput } from "../../components/SearchInput";
import { Badge } from "../../components/Badge";
import { BottomSheet } from "../../components/BottomSheet";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Icon } from "../../components/Icon";
import { apiFetch } from "../../api/client";
import { colors, radius, spacing } from "../../theme/colors";

type Person = {
  id: string;
  displayName: string;
  primaryPhone: string | null;
  alternatePhone: string | null;
  email: string | null;
  notes: string | null;
  types: Array<{ type: string }>;
  tags: Array<{ tagId: string; tag?: { name: string } }>;
  address?: Record<string, string>;
};

export function PeopleListScreen() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [activeTab, setActiveTab] = useState<"personal" | "address" | "more">("personal");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formBusy, setFormBusy] = useState(false);

  // Detail Sheet
  const [detailPerson, setDetailPerson] = useState<Person | null>(null);

  const fetchPeople = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: Person[] }>("/people?limit=100");
      if (res.data?.items) {
        setPeople(res.data.items);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const openCreateModal = () => {
    setEditingPerson(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormNotes("");
    setActiveTab("personal");
    setIsModalOpen(true);
  };

  const openEditModal = (person: Person) => {
    setEditingPerson(person);
    setFormName(person.displayName || "");
    setFormPhone(person.primaryPhone || "");
    setFormEmail(person.email || "");
    setFormAddress(person.address?.addressLine1 || person.address?.street || "");
    setFormNotes(person.notes || "");
    setActiveTab("personal");
    setDetailPerson(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert("Required", "Member name is required.");
      return;
    }

    setFormBusy(true);
    try {
      const payload: any = {
        displayName: formName.trim(),
        primaryPhone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        notes: formNotes.trim() || undefined,
        address: formAddress.trim() ? { addressLine1: formAddress.trim() } : undefined,
        types: ["MEMBER"],
      };

      if (editingPerson) {
        const res = await apiFetch(`/people/${editingPerson.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        if (res.error) throw new Error(res.error);
      } else {
        const res = await apiFetch("/people", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (res.error) throw new Error(res.error);
      }

      setIsModalOpen(false);
      fetchPeople();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save member.");
    } finally {
      setFormBusy(false);
    }
  };

  const filteredPeople = people.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      p.primaryPhone?.includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      <AppHeader
        title="People Directory"
        subtitle="Manage students, customers and staff members"
        rightAction={
          <TouchableOpacity
            onPress={openCreateModal}
            style={styles.addBtn}
          >
            <Icon name="UserPlus" size={16} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      <View style={styles.searchWrap}>
        <SearchInput
          placeholder="Search by name, phone or email..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredPeople}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPeople(); }} />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setDetailPerson(item)}
            style={styles.memberCard}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.displayName.slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={styles.memberMeta}>
              <View style={styles.nameRow}>
                <Text style={styles.memberName}>{item.displayName}</Text>
                <Badge tone="blue">{item.types[0]?.type || "MEMBER"}</Badge>
              </View>
              <Text style={styles.memberPhone}>{item.primaryPhone || "No Phone number"}</Text>
            </View>

            <Icon name="ChevronRight" size={18} color={colors.subtle} />
          </TouchableOpacity>
        )}
      />

      {/* Member Detail BottomSheet */}
      {Boolean(detailPerson) && (
        <BottomSheet
          visible={Boolean(detailPerson)}
          onClose={() => setDetailPerson(null)}
          title={detailPerson?.displayName || "Member Profile"}
          subtitle={detailPerson?.types[0]?.type || "Member"}
          footer={
            <View style={styles.detailFooter}>
              <PrimaryButton
                title="Edit Details"
                onPress={() => openEditModal(detailPerson!)}
                variant="outline"
                style={{ flex: 1 }}
                icon={<Icon name="Edit2" size={14} color={colors.ink} />}
              />
            </View>
          }
        >
          <View style={styles.detailBody}>
            {/* Quick Contact Row */}
            {Boolean(detailPerson?.primaryPhone) && (
              <View style={styles.contactActionRow}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${detailPerson?.primaryPhone}`)}
                  style={[styles.contactBtn, { backgroundColor: colors.brandLight }]}
                >
                  <Icon name="Phone" size={16} color={colors.brand} />
                  <Text style={[styles.contactBtnText, { color: colors.brand }]}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(
                      `https://wa.me/${detailPerson?.primaryPhone?.replace(/\D/g, "")}`
                    )
                  }
                  style={[styles.contactBtn, { backgroundColor: colors.emeraldLight }]}
                >
                  <Icon name="MessageSquare" size={16} color={colors.emerald} />
                  <Text style={[styles.contactBtnText, { color: colors.emerald }]}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Primary Phone</Text>
              <Text style={styles.infoValue}>{detailPerson?.primaryPhone || "—"}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{detailPerson?.email || "—"}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>
                {detailPerson?.address?.addressLine1 || detailPerson?.address?.street || "—"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Notes</Text>
              <Text style={styles.infoValue}>{detailPerson?.notes || "—"}</Text>
            </View>
          </View>
        </BottomSheet>
      )}

      {/* Add / Edit Member Modal */}
      <BottomSheet
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPerson ? "Edit Member Details" : "Add New Member"}
        subtitle="3-Step Member Registration Form"
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              onPress={() => setIsModalOpen(false)}
              variant="outline"
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={formBusy ? "Saving…" : "Save Changes"}
              onPress={handleSave}
              loading={formBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        {/* Step Navigation Pills */}
        <View style={styles.stepPillRow}>
          <TouchableOpacity
            onPress={() => setActiveTab("personal")}
            style={[styles.stepPill, activeTab === "personal" && styles.stepPillActive]}
          >
            <Text style={[styles.stepPillText, activeTab === "personal" && styles.stepPillTextActive]}>
              1. Personal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("address")}
            style={[styles.stepPill, activeTab === "address" && styles.stepPillActive]}
          >
            <Text style={[styles.stepPillText, activeTab === "address" && styles.stepPillTextActive]}>
              2. Address
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("more")}
            style={[styles.stepPill, activeTab === "more" && styles.stepPillActive]}
          >
            <Text style={[styles.stepPillText, activeTab === "more" && styles.stepPillTextActive]}>
              3. More Info
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "personal" && (
          <View style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Ramesh Kumar"
                value={formName}
                onChangeText={setFormName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Primary Phone *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="+91 9876543210"
                keyboardType="phone-pad"
                value={formPhone}
                onChangeText={setFormPhone}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="ramesh@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formEmail}
                onChangeText={setFormEmail}
              />
            </View>
          </View>
        )}

        {activeTab === "address" && (
          <View style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Street / Building Address</Text>
              <TextInput
                style={[styles.formInput, { height: 70 }]}
                placeholder="e.g. Shop 4, Galaxy Plaza, Main Market"
                multiline
                value={formAddress}
                onChangeText={setFormAddress}
              />
            </View>
          </View>
        )}

        {activeTab === "more" && (
          <View style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Internal Profile Notes</Text>
              <TextInput
                style={[styles.formInput, { height: 70 }]}
                placeholder="Additional details, preferences or background..."
                multiline
                value={formNotes}
                onChangeText={setFormNotes}
              />
            </View>
          </View>
        )}
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
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.brand,
  },
  memberMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  memberPhone: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  detailBody: {
    gap: spacing.md,
  },
  contactActionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  infoRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineLight,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 2,
  },
  detailFooter: {
    flexDirection: "row",
    gap: spacing.md,
  },
  stepPillRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  stepPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
  },
  stepPillActive: {
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  stepPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  stepPillTextActive: {
    color: colors.brand,
  },
  formContainer: {
    gap: spacing.md,
  },
  formGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkSecondary,
  },
  formInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 42,
    fontSize: 13.5,
    color: colors.ink,
  },
  modalFooterRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
});
