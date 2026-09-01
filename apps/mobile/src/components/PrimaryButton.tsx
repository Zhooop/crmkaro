import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { colors, radius, spacing } from "../theme/colors";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "emerald" | "secondary" | "danger" | "outline";
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
};

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  textStyle,
  icon,
}: PrimaryButtonProps) {
  const getButtonStyles = () => {
    switch (variant) {
      case "emerald":
        return { bg: colors.emerald, border: colors.emerald, text: "#ffffff" };
      case "secondary":
        return { bg: colors.surfaceMuted, border: colors.line, text: colors.ink };
      case "danger":
        return { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.danger };
      case "outline":
        return { bg: "transparent", border: colors.line, text: colors.ink };
      default:
        return { bg: colors.brand, border: colors.brand, text: "#ffffff" };
    }
  };

  const v = getButtonStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: v.text, marginLeft: icon ? spacing.xs : 0 }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  text: {
    fontSize: 13.5,
    fontWeight: "700",
  },
});
