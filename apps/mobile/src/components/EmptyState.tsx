import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme/colors";
import { PrimaryButton } from "./PrimaryButton";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
};

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      {Boolean(actionLabel && onAction) && (
        <PrimaryButton
          title={actionLabel!}
          onPress={onAction!}
          style={styles.btn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginVertical: spacing.md,
  },
  iconWrap: {
    marginBottom: spacing.md,
    opacity: 0.8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  desc: {
    fontSize: 12.5,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  btn: {
    marginTop: spacing.lg,
  },
});
