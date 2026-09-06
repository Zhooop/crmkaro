import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Icon } from "../../components/Icon";

const BUSINESS_TYPE_PRESETS = [
  "Coaching & Education Institute",
  "Fitness, Gym & Sports Club",
  "Real Estate & Property Consulting",
  "Beauty, Salon & Spa",
  "Retail & E-commerce Store",
  "Software & IT Agency",
  "Healthcare & Clinic",
  "Other",
];

const SOLUTION_PACKAGES = [
  {
    id: "academy",
    name: "Academy, Classes & Studios",
    subtitle: "Tuition, Gym, Dance, Music & Sports Batches",
    highlights: ["WhatsApp Fee Collect", "Batch Attendance", "Staff Salary"],
    modules: ["people", "groups", "quick-collect", "transactions", "payroll", "finance"],
    color: "#2563eb",
    bgColor: "#eff6ff",
    isPopular: true,
  },
  {
    id: "school",
    name: "Schools & Formal Institutes",
    subtitle: "K-12 Schools, Colleges & Academies",
    highlights: ["Student Admissions", "Daily Attendance", "Term Fees"],
    modules: ["students", "people", "groups", "finance", "payroll"],
    color: "#0891b2",
    bgColor: "#ecfeff",
    isPopular: false,
  },
  {
    id: "crm",
    name: "Sales, Leads & Real Estate CRM",
    subtitle: "Brokers, Agencies, Consultants & Deals",
    highlights: ["Visual Lead Pipeline", "Follow-up Alerts", "Invoices"],
    modules: ["people", "crm", "finance", "payroll"],
    color: "#ea580c",
    bgColor: "#fff7ed",
    isPopular: false,
  },
  {
    id: "retail",
    name: "Retail, Trading & Inventory",
    subtitle: "Shops, Wholesalers & Distributors",
    highlights: ["Stock Alerts", "POS Billing", "Customer Ledger"],
    modules: ["people", "inventory", "finance", "payroll"],
    color: "#7c3aed",
    bgColor: "#faf5ff",
    isPopular: false,
  },
];

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, createOrganisation, logout } = useAuth();

  const [workspaceName, setWorkspaceName] = useState("");
  const [selectedType, setSelectedType] = useState("Coaching & Education Institute");
  const [customType, setCustomType] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("academy");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPkg = SOLUTION_PACKAGES.find((p) => p.id === selectedPackageId) || SOLUTION_PACKAGES[0];

  const handleCreate = async () => {
    if (!workspaceName.trim()) {
      setError("Please enter your business or academy name.");
      return;
    }

    const businessType = selectedType === "Other" ? customType.trim() : selectedType;
    if (!businessType) {
      setError("Please specify your business type.");
      return;
    }

    setError(null);
    setLoading(true);
    const res = await createOrganisation({
      name: workspaceName.trim(),
      businessType,
      serviceCodes: selectedPkg.modules,
    });
    setLoading(false);

    if (!res.success) {
      setError(res.error || "Could not set up workspace. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <Image
            source={require("../../../assets/crmkaro-mark.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.stepBadge}>STEP 2 OF 2 • WORKSPACE SETUP</Text>
          <Text style={styles.title}>Create Your Workspace</Text>
          <Text style={styles.subtitle}>
            Welcome, {user?.name || user?.email || "User"}! Set up your organization to start managing members, fees & pipeline.
          </Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {Boolean(error) && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* Business Name */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Business / Academy Name <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.inputWrap}>
              <Icon name="Building" size={16} color={colors.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Apex Classes, Royal Studio, Sharma Realtors"
                placeholderTextColor={colors.muted}
                value={workspaceName}
                onChangeText={setWorkspaceName}
              />
            </View>
          </View>

          {/* Business Category */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Industry / Business Model <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.chipsWrap}>
              {BUSINESS_TYPE_PRESETS.map((type) => {
                const isSelected = selectedType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, isSelected && styles.activeChip]}
                    onPress={() => setSelectedType(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isSelected && styles.activeChipText]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedType === "Other" && (
              <View style={[styles.inputWrap, { marginTop: spacing.sm }]}>
                <TextInput
                  style={styles.input}
                  placeholder="Describe your business model…"
                  placeholderTextColor={colors.muted}
                  value={customType}
                  onChangeText={setCustomType}
                />
              </View>
            )}
          </View>

          {/* Solution Packages */}
          <View style={styles.formGroup}>
            <View style={styles.packageHeaderRow}>
              <Text style={styles.label}>
                Select Solution Package <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.packageBadge}>✓ Pre-configured modules</Text>
            </View>
            <Text style={styles.hintText}>
              Choose the package that best fits your workflow:
            </Text>

            <View style={styles.packageList}>
              {SOLUTION_PACKAGES.map((pkg) => {
                const isSelected = selectedPackageId === pkg.id;
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[
                      styles.packageCard,
                      isSelected && { borderColor: pkg.color, backgroundColor: pkg.bgColor },
                    ]}
                    onPress={() => setSelectedPackageId(pkg.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pkgTopRow}>
                      <View style={styles.pkgTitleWrap}>
                        <Text style={[styles.pkgName, isSelected && { color: pkg.color }]}>
                          {pkg.name}
                        </Text>
                        {pkg.isPopular && (
                          <View style={styles.popularBadge}>
                            <Text style={styles.popularText}>POPULAR</Text>
                          </View>
                        )}
                      </View>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && { borderColor: pkg.color, backgroundColor: pkg.color },
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </View>

                    <Text style={styles.pkgSubtitle}>{pkg.subtitle}</Text>

                    <View style={styles.highlightsRow}>
                      {pkg.highlights.map((h, idx) => (
                        <View key={idx} style={styles.highlightItem}>
                          <Text style={styles.checkIcon}>✓</Text>
                          <Text style={styles.highlightText}>{h}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Submit Button */}
          <PrimaryButton
            title={loading ? "Setting Up Your Workspace…" : "Create Workspace & Continue ➔"}
            onPress={handleCreate}
            loading={loading}
            style={styles.submitBtn}
          />

          {/* Logout switch */}
          <TouchableOpacity onPress={logout} style={styles.logoutBtn} activeOpacity={0.7}>
            <Text style={styles.logoutText}>Want to use another account? <Text style={styles.logoutLink}>Sign Out</Text></Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          Secured with Multi-Tenant PostgreSQL isolation & 256-bit TLS
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  stepBadge: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.brand,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSecondary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.danger,
  },
  hintText: {
    fontSize: 11.5,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    height: "100%",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: 2,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  activeChip: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.inkSecondary,
  },
  activeChipText: {
    color: colors.brand,
    fontWeight: "700",
  },
  packageHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  packageBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.emerald,
  },
  packageList: {
    gap: spacing.sm,
  },
  packageCard: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: "#ffffff",
  },
  pkgTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pkgTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  pkgName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  popularBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: colors.brand,
    letterSpacing: 0.5,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  pkgSubtitle: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  highlightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: 4,
  },
  highlightItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  checkIcon: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.brand,
  },
  highlightText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.inkSecondary,
  },
  submitBtn: {
    marginTop: spacing.md,
    height: 48,
  },
  logoutBtn: {
    alignItems: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  logoutText: {
    fontSize: 12,
    color: colors.muted,
  },
  logoutLink: {
    color: colors.brand,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12.5,
    fontWeight: "600",
  },
  footerText: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
