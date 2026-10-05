/**
 * Owner: ui/components. Card elevated & glass (DESIGN.md § 2/§ 7).
 */
import { View } from "react-native";

export type CardProps = {
  children: React.ReactNode;
  variant?: "elevated" | "glass";
  className?: string;
};

export function Card({ children, variant = "elevated", className = "" }: CardProps) {
  const styles =
    variant === "glass"
      ? "bg-white/5 border border-line rounded-card"
      : "bg-bg-elevated border border-line rounded-card";
  return <View className={`${styles} p-5 ${className}`}>{children}</View>;
}
