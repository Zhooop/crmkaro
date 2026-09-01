import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme/colors";

type Tone = "blue" | "green" | "emerald" | "amber" | "rose" | "red" | "neutral" | "purple";

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  const getColors = () => {
    switch (tone) {
      case "blue":
        return { bg: colors.brandLight, text: colors.brand, border: "#bfdbfe" };
      case "emerald":
      case "green":
        return { bg: colors.emeraldLight, text: colors.emerald, border: colors.emeraldBorder };
      case "amber":
        return { bg: colors.warningBg, text: colors.warning, border: colors.warningBorder };
      case "rose":
      case "red":
        return { bg: colors.dangerBg, text: colors.danger, border: colors.dangerBorder };
      case "purple":
        return { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe" };
      default:
        return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
    }
  };

  const c = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
