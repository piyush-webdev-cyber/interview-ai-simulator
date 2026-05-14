import type { ReactNode } from "react";
import { Button } from "@/components/Button";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  variant?: "primary" | "secondary";
};

export function PrimaryButton({ label, onPress, disabled, loading, icon, variant = "primary" }: PrimaryButtonProps) {
  return <Button label={label} onPress={onPress} disabled={disabled} loading={loading} icon={icon} variant={variant} />;
}
