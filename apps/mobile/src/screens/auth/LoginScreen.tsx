import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Icon } from "../../components/Icon";

type AuthTab = "login" | "register";
type AuthMethod = "otp" | "password";

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { requestEmailOtp, verifyEmailOtp, adminLogin, loginAsDemo } = useAuth();

  const [tab, setTab] = useState<AuthTab>("login");
  const [method, setMethod] = useState<AuthMethod>("otp");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Send OTP
  async function handleSendOtp() {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid work email address.");
      return;
    }

    setError(null);
    setInfoMessage(null);
    setLoading(true);
    const res = await requestEmailOtp(email.trim(), tab);
    setLoading(false);

    if (res.success && res.challengeId) {
      setChallengeId(res.challengeId);
      setInfoMessage(`A 6-digit verification code has been sent to ${email.trim()}`);
    } else {
      setError(res.error || "Could not send verification code. Please check your email.");
    }
  }

  // Verify OTP
  async function handleVerifyOtp() {
    if (!challengeId || otpCode.trim().length !== 6) {
      setError("Please enter the 6-digit code received on your email.");
      return;
    }

    setError(null);
    setLoading(true);
    const res = await verifyEmailOtp(challengeId, otpCode.trim());
    setLoading(false);

    if (!res.success) {
      setError(res.error || "Invalid or expired code. Please try again.");
    }
  }

  // Password Login (Admin)
  async function handlePasswordLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setError(null);
    setLoading(true);
    const res = await adminLogin(email.trim(), password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || "Invalid email or password.");
    }
  }

  // Google Sign-In
  async function handleGoogleSignIn() {
    try {
      const googleOAuthUrl = `https://api.crmkaro.com/auth/google/start?returnTo=${encodeURIComponent("com.crmkaro.app://oauth")}`;
      await Linking.openURL(googleOAuthUrl);
    } catch {
      setError("Could not open Google sign-in. Please use email verification.");
    }
  }

  function switchTab(newTab: AuthTab) {
    setTab(newTab);
    setChallengeId(null);
    setOtpCode("");
    setError(null);
    setInfoMessage(null);
  }

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
          <View style={styles.logoBadge}>
            <Icon name="Zap" size={32} color="#ffffff" />
          </View>
          <Text style={styles.brandTitle}>CRMKaro</Text>
          <Text style={styles.brandSubtitle}>
            Business Operating System for Indian Academies & MSMEs
          </Text>
        </View>

        {/* Demo Mode Quick Access Banner */}
        <TouchableOpacity
          style={styles.demoBanner}
          onPress={loginAsDemo}
          activeOpacity={0.85}
        >
          <View style={styles.demoIconBadge}>
            <Icon name="Compass" size={20} color="#ffffff" />
          </View>
          <View style={styles.demoContent}>
            <Text style={styles.demoTitle}>Explore Demo Mode ➔</Text>
            <Text style={styles.demoSubtitle}>
              Tap to preview Dashboard, CRM, Finance & Students without login
            </Text>
          </View>
        </TouchableOpacity>

        {/* Auth Main Card */}
        <View style={styles.card}>
          {/* Tab Switcher: Sign In vs Create Account */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, tab === "login" && styles.activeTabButton]}
              onPress={() => switchTab("login")}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, tab === "login" && styles.activeTabButtonText]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, tab === "register" && styles.activeTabButton]}
              onPress={() => switchTab("register")}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, tab === "register" && styles.activeTabButtonText]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Google Sign-In Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
          >
            <View style={styles.googleIconContainer}>
              <Text style={styles.googleG}>G</Text>
            </View>
            <Text style={styles.googleButtonText}>
              {tab === "login" ? "Continue with Google" : "Sign up with Google"}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Messages */}
          {Boolean(error) && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {Boolean(infoMessage) && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>✉️ {infoMessage}</Text>
            </View>
          )}

          {/* OTP Verification Step */}
          {challengeId ? (
            <View>
              <Text style={styles.label}>Enter 6-Digit Verification Code</Text>
              <View style={styles.inputWrap}>
                <Icon name="Key" size={18} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="123456"
                  placeholderTextColor={colors.muted}
                  value={otpCode}
                  onChangeText={(val) => setOtpCode(val.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <PrimaryButton
                title={tab === "login" ? "Verify & Sign In" : "Verify & Create Account"}
                onPress={handleVerifyOtp}
                loading={loading}
                style={styles.actionBtn}
              />

              <View style={styles.otpActionsRow}>
                <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
                  <Text style={styles.textLink}>Resend Code</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChallengeId(null)}>
                  <Text style={styles.textLinkSecondary}>Change Email</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : method === "otp" ? (
            /* Email OTP Step */
            <View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Work Email</Text>
                <View style={styles.inputWrap}>
                  <Icon name="Mail" size={16} color={colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="name@company.com"
                    placeholderTextColor={colors.muted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <PrimaryButton
                title={tab === "login" ? "Send Login Code" : "Send Verification Code"}
                onPress={handleSendOtp}
                loading={loading}
                style={styles.actionBtn}
              />

              <TouchableOpacity
                style={styles.switchMethodRow}
                onPress={() => setMethod("password")}
              >
                <Text style={styles.switchMethodText}>
                  Prefer password? <Text style={styles.boldUnderline}>Sign in with Password</Text>
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Password Login Step */
            <View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Work Email</Text>
                <View style={styles.inputWrap}>
                  <Icon name="Mail" size={16} color={colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="name@company.com"
                    placeholderTextColor={colors.muted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <Icon name="Lock" size={16} color={colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.muted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <PrimaryButton
                title="Sign In with Password"
                onPress={handlePasswordLogin}
                loading={loading}
                style={styles.actionBtn}
              />

              <TouchableOpacity
                style={styles.switchMethodRow}
                onPress={() => setMethod("otp")}
              >
                <Text style={styles.switchMethodText}>
                  Use email OTP instead? <Text style={styles.boldUnderline}>Send OTP Code</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          Secured with 256-bit TLS & Multi-Tenant PostgreSQL isolation
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
    justifyContent: "center",
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0284c7",
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  demoIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  demoContent: {
    flex: 1,
  },
  demoTitle: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "800",
  },
  demoSubtitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 11.5,
    marginTop: 2,
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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  activeTabButton: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.muted,
  },
  activeTabButtonText: {
    color: colors.brand,
    fontWeight: "800",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    height: 48,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ea4335",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  googleG: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontSize: 12,
    color: colors.muted,
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
  infoBox: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  infoText: {
    color: "#1d4ed8",
    fontSize: 12.5,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.inkSecondary,
    marginBottom: spacing.xs,
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
    fontSize: 14.5,
    color: colors.ink,
    height: "100%",
  },
  otpInput: {
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  actionBtn: {
    marginTop: spacing.md,
    height: 48,
  },
  otpActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  textLink: {
    fontSize: 13,
    color: colors.brand,
    fontWeight: "700",
  },
  textLinkSecondary: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "600",
  },
  switchMethodRow: {
    alignItems: "center",
    marginTop: spacing.md,
  },
  switchMethodText: {
    fontSize: 12.5,
    color: colors.muted,
  },
  boldUnderline: {
    color: colors.brand,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  footerText: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
