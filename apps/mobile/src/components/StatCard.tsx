import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, radius, spacing } from "../theme/colors";

type StatCardProps = {
  label: string;
  value: string | number;
  change?: string;
  tone?: "blue" | "emerald" | "amber" | "rose" | "purple" | "teal";
  icon?: string;
  onPress?: () => void;
};

export function StatCard({ label, value, change, tone = "blue", onPress }: StatCardProps) {
  const getToneConfig = () => {
    switch (tone) {
      case "emerald":
        return { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", label: "REVENUE" };
      case "amber":
        return { color: "#d97706", bg: "#fef3c7", border: "#fde68a", label: "PIPELINE" };
      case "rose":
        return { color: "#e11d48", bg: "#ffe4e6", border: "#fecdd3", label: "ALERT" };
      case "purple":
        return { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", label: "ACADEMIC" };
      case "teal":
        return { color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4", label: "INVENTORY" };
      default:
        return { color: colors.brandVibrant, bg: colors.brandLight, border: "#bfdbfe", label: "CORE" };
    }
  };

  const tc = getToneConfig();

  const content = (
    <View style={[styles.card, { borderTopColor: tc.color }]}>
      <View style={styles.cardHeader}>
        <Text numberOfLines={1} style={styles.label}>{label}</Text>
        <View style={[styles.toneBadge, { backgroundColor: tc.bg, borderColor: tc.border }]}>
          <View style={[styles.toneDot, { backgroundColor: tc.color }]} />
        </View>
      </View>
      <Text numberOfLines={1} style={styles.value}>{value}</Text>
      {Boolean(change) && (
        <View style={[styles.changeBadge, { backgroundColor: tc.bg, borderColor: tc.border }]}>
          <Text numberOfLines={1} style={[styles.change, { color: tc.color }]}>{change}</Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.line,
    borderTopWidth: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3.5,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  toneBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  toneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
    marginRight: 4,
  },
  value: {
    fontSize: 23,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.6,
    marginVertical: 2,
  },
  changeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 6,
    maxWidth: "100%",
  },
  change: {
    fontSize: 11,
    fontWeight: "700",
  },
});
