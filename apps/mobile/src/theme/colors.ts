export const colors = {
  // Vibrant Brand Signature Palette
  brand: "#1d4ed8",          // Royal Electric Blue
  brandVibrant: "#2563eb",   // Bright Electric Blue
  brandDeep: "#1e3a8a",      // Deep Royal Blue
  brandLight: "#eff6ff",     // Soft Ice Blue
  brandSurface: "#f0f5ff",   // Tinted Surface
  brandBorder: "#bfdbfe",    // Brand Accent Border
  brandNavy: "#0a1628",      // Executive Midnight Slate
  brandSlate: "#1e293b",     // Deep Charcoal Slate

  // Emerald Accents
  emerald: "#059669",        // Crisp Emerald
  emeraldVibrant: "#10b981", // Bright Emerald Glow
  emeraldLight: "#ecfdf5",   // Mint Tint
  emeraldBorder: "#a7f3d0",  // Mint Border
  emeraldDark: "#064e3b",    // Dark Emerald Text

  // Canvas & Surfaces - High contrast
  canvas: "#f1f5f9",         // Cool Slate Background (Soft contrast against white cards)
  surface: "#ffffff",        // Pure White Cards
  surfaceElevated: "#ffffff",// Elevated White Cards
  surfaceMuted: "#f8fafc",   // Light Grayish Tint
  line: "#e2e8f0",           // Card Border Line
  lineLight: "#edf2f7",      // Subtle Divider
  lineDark: "#cbd5e1",       // High Contrast Border

  // Typography
  ink: "#0f172a",            // High Contrast Primary Text
  inkSecondary: "#334155",   // Secondary Slate Text
  muted: "#64748b",          // Subtitle / Label Text
  subtle: "#94a3b8",         // Placeholder / Hint Text

  // Semantic Status Tones
  success: "#10b981",
  successBg: "#ecfdf5",
  successBorder: "#a7f3d0",

  danger: "#ef4444",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",

  warning: "#f59e0b",
  warningBg: "#fffbeb",
  warningBorder: "#fde68a",

  info: "#0ea5e9",
  infoBg: "#f0f9ff",
  infoBorder: "#bae6fd",

  purple: "#8b5cf6",
  purpleBg: "#f5f3ff",
  purpleBorder: "#ddd6fe",

  whatsapp: "#25D366",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  pill: 9999,
};

export const shadows = {
  sm: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3.5,
  },
  lg: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  brandGlow: {
    shadowColor: "#1d4ed8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  emeraldGlow: {
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
};
