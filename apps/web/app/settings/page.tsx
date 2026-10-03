"use client";

import {
  AppShell,
  Badge,
  EmptyState,
  Icon,
  SectionCard,
  StatCard,
  Tabs,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import {
  ALL_AVAILABLE_SERVICES,
  useWorkspace,
  saveActiveServicesToStorage,
} from "@/lib/nav";

type Role = {
  id: string;
  name: string;
  code: string;
  isSystem: boolean;
};

type Member = {
  id: string;
  userId: string;
  roleId: string;
  status: "ACTIVE" | "INVITED" | "DISABLED";
  user: { name: string | null; email: string };
  role: Role;
  joinedAt: string | null;
};

type ServiceItem = {
  code: string;
  name: string;
  status: "ACTIVE" | "DISABLED" | "TRIAL" | "PENDING";
  enabled: boolean;
};

type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor?: { name: string | null; email: string };
  createdAt: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const api = getApiUrl();

  // Data states
  const [activeTab, setActiveTab] = useState<"profile" | "team" | "services" | "payouts" | "audit">("profile");
  const [orgDetails, setOrgDetails] = useState<{
    id: string;
    name: string;
    slug?: string;
    businessType?: string;
    currency?: string;
    timezone?: string;
    logoUrl?: string | null;
    phone?: string | null;
    address?: string | null;
    createdAt?: string;
  } | null>(null);

  // Branding Form State
  const [formName, setFormName] = useState("");
  const [formBusinessType, setFormBusinessType] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formLogoUrl, setFormLogoUrl] = useState<string | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Payouts & Bank Account State
  type PayoutSettings = {
    configured: boolean;
    id?: string;
    payoutStatus: "NOT_CONFIGURED" | "ACTIVE" | "PENDING_VERIFICATION";
    gatewayMode: "PLATFORM_ROUTE" | "CUSTOM_KEYS";
    settlementCycle: string;
    isVerified: boolean;
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    accountNumberMasked: string;
    ifscCode: string;
    upiId: string;
    panNumber: string;
    businessGstin: string;
    customRazorpayKeyId: string;
    hasCustomSecret: boolean;
  };

  const [payouts, setPayouts] = useState<PayoutSettings | null>(null);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [savingPayouts, setSavingPayouts] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    upiId: "",
    panNumber: "",
    businessGstin: "",
    gatewayMode: "PLATFORM_ROUTE" as "PLATFORM_ROUTE" | "CUSTOM_KEYS",
    customRazorpayKeyId: "",
    customRazorpaySecret: "",
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const {
    orgName,
    userName,
    userRole,
    businessType,
    activeServices,
    organisations,
    navItems,
    updateWorkspace,
  } = useWorkspace();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [activeServiceCodes, setActiveServiceCodes] = useState<string[]>(activeServices);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  useEffect(() => {
    setActiveServiceCodes(activeServices);
  }, [activeServices]);

  useEffect(() => {
    if (orgDetails) {
      setFormName(orgDetails.name || "");
      setFormBusinessType(orgDetails.businessType || "");
      setFormPhone(orgDetails.phone || "");
      setFormAddress(orgDetails.address || "");
      setFormLogoUrl(orgDetails.logoUrl || null);
    }
  }, [orgDetails]);

  const compressImage = (file: File, maxWidth = 500, maxHeight = 500, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          const isPng = file.type === "image/png";
          if (!isPng) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = isPng
            ? canvas.toDataURL("image/png")
            : canvas.toDataURL("image/jpeg", quality);

          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast("Optimizing and compressing logo...", "success");
      const compressed = await compressImage(file, 500, 500, 0.82);
      setFormLogoUrl(compressed);
      showToast("✨ Logo optimized! Click Save to apply.", "success");
    } catch {
      showToast("Failed to process logo image.", "error");
    }
  };

  const handleSaveBranding = async () => {
    if (!orgDetails?.id) return;
    if (!formName.trim()) {
      showToast("Organisation name is required.", "error");
      return;
    }
    setSavingBranding(true);
    try {
      const res = await authFetch(`${api}/organisations/${orgDetails.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          businessType: formBusinessType.trim() || null,
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          logoUrl: formLogoUrl,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrgDetails(updated);
        updateWorkspace({ orgName: updated.name, businessType: updated.businessType || undefined });
        showToast("✨ Organisation branding & logo saved successfully! PDFs will now include this branding.", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || "Failed to save branding.", "error");
      }
    } catch {
      showToast("Network error while saving branding.", "error");
    } finally {
      setSavingBranding(false);
    }
  };

  // Load session context
  const loadContext = useCallback(async () => {
    try {
      const meRes = await authFetch(`${api}/auth/me`, { credentials: "include" });
      if (meRes.status === 401) {
        router.replace("/login");
        return;
      }
      const orgsRes = await authFetch(`${api}/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgList = await orgsRes.json();
        const activeOrgEntry = orgList.find(
          (o: { organisation: { id: string; name: string } | null; role: { name: string } }) =>
            o.organisation,
        );
        if (activeOrgEntry?.organisation) {
          setOrgDetails(activeOrgEntry.organisation);
          const srvs = activeOrgEntry.activeServices || activeOrgEntry.organisation.activeServices;
          updateWorkspace({
            orgName: activeOrgEntry.organisation.name,
            userRole: activeOrgEntry.role?.name || "Admin",
            businessType: activeOrgEntry.organisation.businessType || "Business",
            ...(Array.isArray(srvs) && srvs.length > 0 ? { activeServices: srvs } : {}),
          });
        }
      }
    } catch {
      // ignore
    }
  }, [api, router, updateWorkspace]);

  // Load team & roles
  const loadTeam = useCallback(async () => {
    try {
      const rolesRes = await authFetch(`${api}/access/roles`, { credentials: "include" });
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  // Load Services
  const loadServices = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/access/services`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setServices(data || []);
        const activeList = data.filter((s: ServiceItem) => s.enabled).map((s: ServiceItem) => s.code);
        setActiveServiceCodes(activeList);
        updateWorkspace({ activeServices: activeList });
      }
    } catch {
      // ignore
    }
  }, [api, updateWorkspace]);

  // Load Audit
  const loadAudit = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/access/audit?limit=50`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.items || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  // Load Payouts & Bank Settings
  const loadPayouts = useCallback(async (orgId: string) => {
    setLoadingPayouts(true);
    try {
      const res = await authFetch(`${api}/organisations/${orgId}/payout-settings`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPayouts(data);
        setPayoutForm({
          accountHolderName: data.accountHolderName || "",
          bankName: data.bankName || "",
          accountNumber: data.accountNumberMasked || data.accountNumber || "",
          confirmAccountNumber: data.accountNumberMasked || data.accountNumber || "",
          ifscCode: data.ifscCode || "",
          upiId: data.upiId || "",
          panNumber: data.panNumber || "",
          businessGstin: data.businessGstin || "",
          gatewayMode: (data.gatewayMode as "PLATFORM_ROUTE" | "CUSTOM_KEYS") || "PLATFORM_ROUTE",
          customRazorpayKeyId: data.customRazorpayKeyId || "",
          customRazorpaySecret: data.hasCustomSecret ? "••••••••••••••••" : "",
        });
      }
    } catch {
      // ignore
    } finally {
      setLoadingPayouts(false);
    }
  }, [api]);

  useEffect(() => {
    if (orgDetails?.id) {
      loadPayouts(orgDetails.id);
    }
  }, [orgDetails?.id, loadPayouts]);

  const handleSavePayouts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgDetails?.id) return;

    if (
      payoutForm.accountNumber &&
      !payoutForm.accountNumber.includes("•") &&
      payoutForm.accountNumber !== payoutForm.confirmAccountNumber
    ) {
      showToast("Account numbers do not match! Please verify.", "error");
      return;
    }

    setSavingPayouts(true);
    try {
      const payload: any = {
        accountHolderName: payoutForm.accountHolderName.trim(),
        bankName: payoutForm.bankName.trim(),
        ifscCode: payoutForm.ifscCode.trim().toUpperCase(),
        upiId: payoutForm.upiId.trim().toLowerCase(),
        panNumber: payoutForm.panNumber.trim().toUpperCase(),
        businessGstin: payoutForm.businessGstin.trim().toUpperCase(),
        gatewayMode: payoutForm.gatewayMode,
        customRazorpayKeyId: payoutForm.customRazorpayKeyId.trim(),
      };

      if (payoutForm.accountNumber && !payoutForm.accountNumber.includes("•")) {
        payload.accountNumber = payoutForm.accountNumber.trim();
      }

      if (payoutForm.customRazorpaySecret && !payoutForm.customRazorpaySecret.includes("•")) {
        payload.customRazorpaySecret = payoutForm.customRazorpaySecret.trim();
      }

      const res = await authFetch(`${api}/organisations/${orgDetails.id}/payout-settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setPayouts(data);
        showToast("🏦 Bank account & payout settlement settings saved successfully!", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || "Failed to update payout settings.", "error");
      }
    } catch {
      showToast("Network error while saving payout settings.", "error");
    } finally {
      setSavingPayouts(false);
    }
  };

  useEffect(() => {
    loadContext();
    loadTeam();
    loadServices();
    loadAudit();
    setLoading(false);
  }, [loadContext, loadTeam, loadServices, loadAudit]);

  async function handleToggleService(serviceCode: string, currentlyEnabled: boolean) {
    setTogglingCode(serviceCode);
    try {
      const action = currentlyEnabled ? "disable" : "enable";
      const res = await authFetch(`${api}/access/services/${serviceCode}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await loadServices();
      }
    } catch {
      // ignore
    } finally {
      setTogglingCode(null);
    }
  }

  const tabItems = [
    { id: "profile", label: "Workspace Profile" },
    { id: "services", label: "Services & Modules", count: services.length > 0 ? services.filter((s) => s.enabled).length : activeServices.length },
    { id: "payouts", label: "Bank & Payouts" },
    { id: "team", label: "Team & Roles", count: roles.length > 0 ? roles.length : (loading ? undefined : 0) },
    { id: "audit", label: "Security Audit Log", count: auditLogs.length > 0 ? auditLogs.length : (loading ? undefined : 0) },
  ];

  const [copiedId, setCopiedId] = useState(false);

  function copyTenantId() {
    if (orgDetails?.id) {
      navigator.clipboard.writeText(orgDetails.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  }

  const initials = (orgDetails?.name || orgName)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell
      currentPath="/settings"
      nav={navItems}
      organisation={orgName}
      organisations={organisations}
      product="CRMKaro"
      userName={userName}
      userRole={userRole}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
      onPrefetch={(href) => router.prefetch(href)}
    >
      <div className="page-heading">
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            <Icon name="settings" size={15} /> System Configuration & Modules
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", margin: 0, letterSpacing: "-0.02em" }}>
            Workspace Settings
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "4px 0 0" }}>
            Manage organization identity, enable/archive business services, team roles, and security audit logs.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Tabs
          active={activeTab}
          items={tabItems}
          onChange={(id) => setActiveTab(id as any)}
        />
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div>
          {/* Org Profile Header Card */}
          <div className="profile-hero-card">
            <div className="profile-avatar-lg" suppressHydrationWarning>{initials}</div>
            <div className="profile-hero-meta">
              <div className="profile-hero-title-row">
                <h2 suppressHydrationWarning>{orgDetails?.name || orgName}</h2>
                <Badge tone="blue">Production Tenant</Badge>
              </div>
              <p className="profile-hero-subtitle">
                <span>Domain Slug:</span>
                <code>{orgDetails?.slug || "crmkaro-primary"}</code>
                <span>·</span>
                <span>{orgDetails?.businessType || businessType || "Business"}</span>
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <StatCard
              label="Active Enabled Modules"
              value={`${services.length > 0 ? services.filter((s) => s.enabled).length : activeServices.length} of ${ALL_AVAILABLE_SERVICES.length}`}
              change="Configurable on Services tab"
              icon="services"
            />
            <StatCard
              label="Assigned Roles"
              value={roles.length > 0 ? roles.length.toString() : (loading ? "..." : "6")}
              change="Strict RBAC Matrix"
              icon="shield"
            />
            <StatCard
              label="Audited Events"
              value={auditLogs.length > 0 ? auditLogs.length.toString() : (loading ? "..." : "0")}
              change="PostgreSQL Append-Only"
              icon="activity"
            />
          </div>

          {/* Organisation Branding & Invoice Logo Card */}
          <div style={{ marginBottom: 24 }}>
            <SectionCard
              title="Organisation Branding & Invoicing Identity"
              subtitle="Upload your custom business logo, contact number, and address to appear on all Invoice PDFs and receipts"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Logo Uploader Row */}
                <div className="logo-uploader-card" style={{ display: "flex", alignItems: "center", gap: 24, padding: "16px 20px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 12,
                      border: "2px dashed #cbd5e1",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    {formLogoUrl ? (
                      <img
                        src={formLogoUrl}
                        alt="Org Logo"
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--brand)" }}>
                        {initials}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                      Custom Business Logo
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
                      Upload any image (PNG, JPG, WEBP). High-resolution files are automatically compressed & optimized for crisp Invoice PDFs.
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <label
                        className="secondary-button"
                        style={{
                          cursor: "pointer",
                          padding: "6px 14px",
                          fontSize: 12.5,
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Icon name="upload" size={14} />
                        <span>{formLogoUrl ? "Change Logo" : "Upload Logo"}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          style={{ display: "none" }}
                          onChange={handleLogoUpload}
                        />
                      </label>
                      {formLogoUrl && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setFormLogoUrl(null)}
                          style={{ padding: "6px 12px", fontSize: 12.5, color: "#dc2626" }}
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Fields Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                      Business / Institute Name *
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5 }}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Gurubrahma Classes"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                      Category / Business Type
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5 }}
                      value={formBusinessType}
                      onChange={(e) => setFormBusinessType(e.target.value)}
                      placeholder="e.g. Education, Coaching, Fitness Academy"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                      Official Invoicing Phone
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5 }}
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                      Office / Institute Address
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5 }}
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="e.g. Shop 4, Galaxy Plaza, Badlapur East"
                    />
                  </div>
                </div>

                {/* Action Row */}
                <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={savingBranding}
                    onClick={handleSaveBranding}
                    style={{
                      padding: "9px 20px",
                      fontSize: 13.5,
                      fontWeight: 700,
                      borderRadius: 8,
                      background: "#2563eb",
                      color: "#ffffff",
                      cursor: savingBranding ? "not-allowed" : "pointer",
                      border: "none",
                    }}
                  >
                    {savingBranding ? "Saving Branding..." : "💾 Save Branding & Details"}
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Two Detailed Cards */}
          <div className="profile-detail-grid">
            <SectionCard title="Organisation Metadata" subtitle="Core workspace identification & regional settings">
              <div className="key-value-list">
                <div className="key-value-row">
                  <span className="key-value-label">
                    <Icon name="building" size={14} />
                    <span>Business Name</span>
                  </span>
                  <span className="key-value-value">{orgDetails?.name || orgName}</span>
                </div>

                <div className="key-value-row">
                  <span className="key-value-label">
                    <Icon name="tag" size={14} />
                    <span>Business Type</span>
                  </span>
                  <span className="key-value-value">{orgDetails?.businessType || "Business"}</span>
                </div>

                <div className="key-value-row">
                  <span className="key-value-label">
                    <Icon name="refresh" size={14} />
                    <span>Operating Timezone</span>
                  </span>
                  <span className="key-value-value">{orgDetails?.timezone || "Asia/Kolkata (IST, UTC+05:30)"}</span>
                </div>

                <div className="key-value-row">
                  <span className="key-value-label">
                    <Icon name="finance" size={14} />
                    <span>Workspace Currency</span>
                  </span>
                  <span className="key-value-value">{orgDetails?.currency || "INR (₹ Indian Rupee)"}</span>
                </div>

                <div className="key-value-row">
                  <span className="key-value-label">
                    <Icon name="building" size={14} />
                    <span>Deployment Tier</span>
                  </span>
                  <span className="key-value-value">
                    <Badge tone="blue">Enterprise Multi-Tenant</Badge>
                  </span>
                </div>

                <div className="key-value-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                  <span className="key-value-label">
                    <Icon name="shield" size={14} />
                    <span>Tenant UUID (PostgreSQL Isolation Key)</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                    <code className="code-chip" style={{ flex: 1 }}>
                      {orgDetails?.id || "82cb99ee-077f-4a37-8c34-e9f22231a0bf"}
                    </code>
                    <button
                      className="secondary-button"
                      onClick={copyTenantId}
                      style={{ padding: "4px 8px", fontSize: 11 }}
                    >
                      {copiedId ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Data Isolation & Compliance" subtitle="Engine-level security & immutable audit logging">
              <div className="security-banner">
                <Icon name="checkCircle" size={16} />
                <span>Zero-Leakage Multi-Tenancy Active</span>
              </div>

              <div className="security-checklist">
                <div className="security-item">
                  <div className="security-item-icon">
                    <Icon name="shield" size={16} />
                  </div>
                  <div className="security-item-text">
                    <strong>PostgreSQL Row-Level Security (RLS)</strong>
                    <p>Database queries are partitioned at the PostgreSQL kernel level. Cross-tenant leakage is impossible.</p>
                  </div>
                </div>

                <div className="security-item">
                  <div className="security-item-icon">
                    <Icon name="checkCircle" size={16} />
                  </div>
                  <div className="security-item-text">
                    <strong>Append-Only Audit Trail</strong>
                    <p>Every create, update, and delete operation is signed and logged with actor metadata.</p>
                  </div>
                </div>

                <div className="security-item">
                  <div className="security-item-icon">
                    <Icon name="shield" size={16} />
                  </div>
                  <div className="security-item-text">
                    <strong>HttpOnly Encrypted Sessions</strong>
                    <p>Browser credentials use 256-bit signed tokens with SameSite=Lax protection against XSS and CSRF.</p>
                  </div>
                </div>

                <div className="security-item">
                  <div className="security-item-icon">
                    <Icon name="activity" size={16} />
                  </div>
                  <div className="security-item-text">
                    <strong>Role-Based Access Control (RBAC)</strong>
                    <p>Granular permissions (Owner, Admin, Manager, Staff) enforced before every route handler.</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* Services Entitlements Tab */}
      {activeTab === "services" && (
        <div style={{ maxWidth: 840 }}>
          <div style={{ marginBottom: 20, padding: "16px 20px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 750, color: "var(--ink)" }}>
              🧩 Active Workspace Services & Navigation Visibility
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              Enable or archive business services. <strong>Archived / disabled services are immediately hidden from the sidebar menu</strong> across all pages and protected from unauthorized data entry.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ALL_AVAILABLE_SERVICES.map((srv) => {
              const currentSrv = services.find((s) => s.code === srv.code);
              const isEnabled = currentSrv ? currentSrv.enabled : activeServiceCodes.includes(srv.code);
              const isBusy = togglingCode === srv.code;

              return (
                <div
                  key={srv.code}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "18px 22px",
                    background: "#fff",
                    border: isEnabled ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                    borderRadius: 12,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    opacity: isEnabled ? 1 : 0.75,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: isEnabled ? "#eff6ff" : "#f1f5f9",
                        color: isEnabled ? "var(--brand)" : "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={srv.icon} size={22} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <strong style={{ fontSize: 14.5, color: "var(--ink)" }}>{srv.name}</strong>
                        <Badge tone={isEnabled ? "green" : "neutral"}>
                          {isEnabled ? "ACTIVE (IN MENU)" : "ARCHIVED (HIDDEN)"}
                        </Badge>
                      </div>
                      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 0" }}>
                        {srv.desc}
                      </p>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleService(srv.code, isEnabled)}
                      style={{
                        padding: "7px 16px",
                        fontSize: 12.5,
                        fontWeight: 700,
                        borderRadius: 8,
                        cursor: "pointer",
                        border: isEnabled ? "1px solid #fecaca" : "1px solid var(--brand)",
                        background: isEnabled ? "#fef2f2" : "var(--brand)",
                        color: isEnabled ? "#b91c1c" : "#ffffff",
                        transition: "all 0.15s ease",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {isBusy
                        ? "Updating…"
                        : isEnabled
                          ? "Archive & Hide from Menu"
                          : "+ Enable & Show in Menu"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bank & Payouts Tab */}
      {activeTab === "payouts" && (
        <div style={{ maxWidth: 860, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header Banner */}
          <div
            style={{
              padding: "18px 24px",
              background: "#f8fafc",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: "var(--ink)" }}>
                  🏦 Bank Account & Payment Settlements
                </h3>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 11.5,
                    fontWeight: 750,
                    background: payouts?.configured ? "#ecfdf5" : "#fffbeb",
                    color: payouts?.configured ? "#059669" : "#b45309",
                    border: `1px solid ${payouts?.configured ? "#a7f3d0" : "#fde68a"}`,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: payouts?.configured ? "#10b981" : "#f59e0b",
                    }}
                  />
                  {payouts?.configured
                    ? "ACTIVE — Ready to Receive Fees"
                    : "SETUP REQUIRED — Add Bank Details"}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, maxWidth: 620 }}>
                Configure where student fee payments and customer invoices should be deposited. Supports <strong>Instant Direct UPI QR (0% platform charge)</strong> and <strong>Automated Next-Day Bank Settlement (T+1)</strong>.
              </p>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div style={{ padding: "16px 20px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Linked Bank</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>
                {payouts?.bankName || "Not Linked Yet"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {payouts?.accountNumberMasked || "Add Account Number"}
              </div>
            </div>

            <div style={{ padding: "16px 20px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Direct Scan UPI ID</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: payouts?.upiId ? "#059669" : "var(--muted)", marginTop: 4 }}>
                {payouts?.upiId || "No UPI ID Configured"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Instant PhonePe/GPay QR (0% Fee)
              </div>
            </div>

            <div style={{ padding: "16px 20px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Settlement Cycle</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--brand)", marginTop: 4 }}>
                {payouts?.settlementCycle || "T+1 Daily"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Auto-Transferred via NEFT/IMPS
              </div>
            </div>
          </div>

          {/* Bank Account Form */}
          <SectionCard title="Business Bank Account Information" subtitle="Direct beneficiary details for fee settlements and invoice collections">
            <form onSubmit={handleSavePayouts}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                    Account Holder Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Academy Pvt Ltd or Rohit Kumar"
                    value={payoutForm.accountHolderName}
                    onChange={(e) => setPayoutForm({ ...payoutForm, accountHolderName: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Bank, State Bank of India, ICICI"
                    value={payoutForm.bankName}
                    onChange={(e) => setPayoutForm({ ...payoutForm, bankName: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                    Bank Account Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50100492817291"
                    value={payoutForm.accountNumber}
                    onChange={(e) => setPayoutForm({ ...payoutForm, accountNumber: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                    Confirm Account Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Re-enter Account Number"
                    value={payoutForm.confirmAccountNumber}
                    onChange={(e) => setPayoutForm({ ...payoutForm, confirmAccountNumber: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                    IFSC Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    placeholder="e.g. HDFC0001234"
                    value={payoutForm.ifscCode}
                    onChange={(e) => setPayoutForm({ ...payoutForm, ifscCode: e.target.value.toUpperCase() })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                    Institute UPI ID (VPA)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. apexacademy@okhdfcbank"
                    value={payoutForm.upiId}
                    onChange={(e) => setPayoutForm({ ...payoutForm, upiId: e.target.value.toLowerCase() })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5 }}
                  />
                  <span style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, display: "block" }}>
                    Generated QR code on public fee links will route 100% money directly to this UPI ID.
                  </span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                    PAN Number
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
                    value={payoutForm.panNumber}
                    onChange={(e) => setPayoutForm({ ...payoutForm, panNumber: e.target.value.toUpperCase() })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5, textTransform: "uppercase" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                    Business GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={payoutForm.businessGstin}
                    onChange={(e) => setPayoutForm({ ...payoutForm, businessGstin: e.target.value.toUpperCase() })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5, textTransform: "uppercase" }}
                  />
                </div>
              </div>

              {/* Online Payment Gateway Preference */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 13.5, fontWeight: 750, color: "var(--ink)", marginBottom: 12 }}>
                  ⚡ Online Payment Gateway Preference
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 18px",
                      borderRadius: 10,
                      border: `2px solid ${payoutForm.gatewayMode === "PLATFORM_ROUTE" ? "var(--brand)" : "#e2e8f0"}`,
                      background: payoutForm.gatewayMode === "PLATFORM_ROUTE" ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="radio"
                      name="gatewayMode"
                      checked={payoutForm.gatewayMode === "PLATFORM_ROUTE"}
                      onChange={() => setPayoutForm({ ...payoutForm, gatewayMode: "PLATFORM_ROUTE" })}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <strong style={{ fontSize: 13.5, color: "var(--ink)", display: "block" }}>
                        CRMKaro Auto-Route (Recommended)
                      </strong>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "3px 0 0", lineHeight: 1.4 }}>
                        Zero technical setup. Online payments made by students are automatically routed & settled into your bank account (T+1).
                      </p>
                    </div>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 18px",
                      borderRadius: 10,
                      border: `2px solid ${payoutForm.gatewayMode === "CUSTOM_KEYS" ? "var(--brand)" : "#e2e8f0"}`,
                      background: payoutForm.gatewayMode === "CUSTOM_KEYS" ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="radio"
                      name="gatewayMode"
                      checked={payoutForm.gatewayMode === "CUSTOM_KEYS"}
                      onChange={() => setPayoutForm({ ...payoutForm, gatewayMode: "CUSTOM_KEYS" })}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <strong style={{ fontSize: 13.5, color: "var(--ink)", display: "block" }}>
                        Own Razorpay Gateway Account
                      </strong>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "3px 0 0", lineHeight: 1.4 }}>
                        Use your own Razorpay Merchant API Key & Secret. Money deposits directly to your merchant account.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Custom Razorpay Keys fields */}
                {payoutForm.gatewayMode === "CUSTOM_KEYS" && (
                  <div style={{ marginTop: 16, padding: "16px 18px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                        Razorpay Key ID *
                      </label>
                      <input
                        type="text"
                        placeholder="rzp_live_..."
                        value={payoutForm.customRazorpayKeyId}
                        onChange={(e) => setPayoutForm({ ...payoutForm, customRazorpayKeyId: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                        Razorpay Key Secret *
                      </label>
                      <input
                        type="password"
                        placeholder="Enter API Key Secret"
                        value={payoutForm.customRazorpaySecret}
                        onChange={(e) => setPayoutForm({ ...payoutForm, customRazorpaySecret: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={savingPayouts}
                  style={{
                    padding: "10px 24px",
                    fontSize: 14,
                    fontWeight: 700,
                    borderRadius: 8,
                    background: "var(--brand)",
                    color: "#ffffff",
                    border: "none",
                    cursor: savingPayouts ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
                  }}
                >
                  {savingPayouts ? "Saving Bank Settings…" : "💾 Save Bank & Payout Settings"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      )}

      {/* Team & Roles Tab */}
      {activeTab === "team" && (
        <div style={{ maxWidth: 840 }}>
          <div className="table-responsive">
            <div className="desktop-table-view">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Role Name</th>
                    <th>System Preset</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td>
                        <Badge tone={r.isSystem ? "blue" : "neutral"}>
                          {r.isSystem ? "System Role" : "Custom Role"}
                        </Badge>
                      </td>
                      <td style={{ color: "var(--muted)" }}>
                        {r.name === "Owner"
                          ? "Full ownership and tenant billing management."
                          : r.name === "Admin"
                            ? "Full operational and read/write capabilities across all modules."
                            : r.name === "Manager"
                              ? "Can manage customer/student records and team operations."
                              : "Standard operational permissions."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-cards-view">
              {roles.map((r) => (
                <div key={r.id} className="mobile-record-card">
                  <div className="mobile-card-header">
                    <div className="mobile-card-name">{r.name}</div>
                    <Badge tone={r.isSystem ? "blue" : "neutral"}>
                      {r.isSystem ? "System Role" : "Custom Role"}
                    </Badge>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.4 }}>
                    {r.name === "Owner"
                      ? "Full ownership and tenant billing management."
                      : r.name === "Admin"
                        ? "Full operational and read/write capabilities across all modules."
                        : r.name === "Manager"
                          ? "Can manage customer/student records and team operations."
                          : "Standard operational permissions."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === "audit" && (
        <div style={{ maxWidth: 840 }}>
          {auditLogs.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>
              No audited events logged yet.
            </div>
          ) : (
            <div className="table-responsive">
              <div className="desktop-table-view">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity Type</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <strong>{log.action}</strong>
                        </td>
                        <td>
                          <span className="code-chip">{log.entityType}</span>
                        </td>
                        <td>
                          <time style={{ fontSize: 12, color: "var(--muted)" }}>
                            {new Date(log.createdAt).toLocaleString("en-IN")}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-cards-view">
                {auditLogs.map((log) => (
                  <div key={log.id} className="mobile-record-card">
                    <div className="mobile-card-header">
                      <div>
                        <div className="mobile-card-name">{log.action}</div>
                        <div className="mobile-card-subtext">
                          {new Date(log.createdAt).toLocaleString("en-IN")}
                        </div>
                      </div>
                      <span className="code-chip">{log.entityType}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: "12px 20px",
            background: toast.type === "error" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 600,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "fadeInUp 0.2s ease-out",
          }}
        >
          <span>{toast.message}</span>
        </div>
      )}
    </AppShell>
  );
}
