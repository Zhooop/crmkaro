import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { apiFetch } from "../../api/client";
import { colors, radius, spacing } from "../../theme/colors";

type Group = {
  id: string;
  name: string;
  code: string;
  feeAmountMinor: number;
  feeFrequency: string;
  workingDays: string;
  totalMembers: number;
  totalActiveMembers: number;
};

export function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await apiFetch<any>("/groups");
      if (res.data) {
        setGroups(Array.isArray(res.data) ? res.data : res.data.items || []);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const formatRupees = (minor = 0) => `₹${(minor / 100).toLocaleString("en-IN")}`;

  return (
    <View style={styles.container}>
      <AppHeader
        title="Groups & Batches"
        subtitle="Manage student batches, rosters and schedules"
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
          <View style={styles.groupCard}>
            <View style={styles.groupTop}>
              <View>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={styles.groupCode}>{item.code || "BATCH"}</Text>
              </View>
              <Badge tone="emerald">{formatRupees(item.feeAmountMinor)}/mo</Badge>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon name="Users" size={14} color={colors.muted} />
                <Text style={styles.metaText}>{item.totalActiveMembers || 0} Members</Text>
              </View>
              <View style={styles.metaItem}>
                <Icon name="Calendar" size={14} color={colors.muted} />
                <Text style={styles.metaText}>{item.workingDays || "Mon - Fri"}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
  },
  groupTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    marginTop: 1,
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
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.inkSecondary,
    fontWeight: "600",
  },
});
