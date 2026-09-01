import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme/colors";

type StatCardProps = {
  label: string;
  value: string | number;
  change?: string;
  tone?: "blue" | "emerald" | "amber" | "rose" | "purple";
  icon?: string;
};

export function StatCard({ label, value, change, tone = "blue" }: StatCardProps) {
  const getBorderColor = () => {
    switch (tone) {
      case "emerald":
        return "#10b981";
      case "amber":
        return "#f59e0b";
      case "rose":
        return "#f43f5e";
      case "purple":
        return "#8b5cf6";
      default:
        return colors.brand;
    }
  };

  return (
    <View style={[styles.card, { borderLeftColor: getBorderColor(), borderLeftWidth: 4 }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {Boolean(change) && <Text style={styles.change}>{change}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  label: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  change: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
});
