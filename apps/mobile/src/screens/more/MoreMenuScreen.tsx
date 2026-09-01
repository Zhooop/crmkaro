import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppHeader } from "../../components/AppHeader";
import { Icon, IconName } from "../../components/Icon";
import { colors, radius, spacing } from "../../theme/colors";

type ModuleItem = {
  id: string;
  title: string;
  subtitle: string;
  iconName: IconName;
  iconColor: string;
  route: string;
  bg: string;
};

export function MoreMenuScreen() {
  const navigation = useNavigation<any>();

  const modules: ModuleItem[] = [
    {
      id: "students",
      title: "Students & Academy",
      subtitle: "Roll numbers, standards & daily attendance",
      iconName: "GraduationCap",
      iconColor: colors.brand,
      route: "Students",
      bg: colors.brandLight,
    },
    {
      id: "groups",
      title: "Groups & Batches",
      subtitle: "Batch rosters, schedules & fees",
      iconName: "Users",
      iconColor: colors.emerald,
      route: "Groups",
      bg: colors.emeraldLight,
    },
    {
      id: "crm",
      title: "Leads & CRM Pipeline",
      subtitle: "Deals kanban, follow-up calls & inquiries",
      iconName: "TrendingUp",
      iconColor: "#ea580c",
      route: "CRM",
      bg: "#fff7ed",
    },
    {
      id: "settings",
      title: "Workspace Settings",
      subtitle: "Branding, organization logo & security",
      iconName: "Settings",
      iconColor: colors.ink,
      route: "Settings",
      bg: colors.surfaceMuted,
    },
  ];

  return (
    <View style={styles.container}>
      <AppHeader title="All Modules" subtitle="Complete CRMKaro Service Suite" />

      <ScrollView contentContainerStyle={styles.content}>
        {modules.map((m) => (
          <TouchableOpacity
            key={m.id}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(m.route)}
            style={styles.moduleCard}
          >
            <View style={[styles.iconWrap, { backgroundColor: m.bg }]}>
              <Icon name={m.iconName} size={20} color={m.iconColor} />
            </View>
            <View style={styles.meta}>
              <Text style={styles.title}>{m.title}</Text>
              <Text style={styles.subtitle}>{m.subtitle}</Text>
            </View>
            <Icon name="ChevronRight" size={18} color={colors.subtle} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  moduleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  meta: {
    flex: 1,
  },
  title: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
});
