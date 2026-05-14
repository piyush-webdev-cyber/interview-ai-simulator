import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ label, onPress, disabled, loading, icon, variant = "primary" }: ButtonProps) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        isPrimary && styles.primary,
        variant === "secondary" && styles.secondary,
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={isPrimary ? "#FFFFFF" : colors.text} /> : icon}
        <Text style={[styles.label, isPrimary && styles.primaryLabel]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: colors.brand,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.55,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  primaryLabel: {
    color: "#FFFFFF",
  },
});
