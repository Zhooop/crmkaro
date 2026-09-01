import React from "react";
import * as LucideIcons from "lucide-react-native";
import { colors } from "../theme/colors";

export type IconName =
  | "Home"
  | "Zap"
  | "Users"
  | "UserPlus"
  | "FileText"
  | "Menu"
  | "Search"
  | "X"
  | "Check"
  | "Phone"
  | "MessageSquare"
  | "Mail"
  | "Edit2"
  | "Trash2"
  | "ChevronRight"
  | "User"
  | "GraduationCap"
  | "TrendingUp"
  | "Settings"
  | "LogOut"
  | "Building"
  | "Shield"
  | "Plus"
  | "Activity"
  | "Calendar"
  | "Clock"
  | "Lock";

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  style?: any;
};

export function Icon({ name, size = 18, color = colors.ink, style }: IconProps) {
  const Component = (LucideIcons as any)[name];
  if (!Component) return null;
  return <Component size={size} color={color} style={style} />;
}
