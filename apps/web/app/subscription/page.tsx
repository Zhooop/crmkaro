"use client";

import {
  AppShell,
  Badge,
  Icon,
  StatCard,
} from "@crmkaro/ui";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import { useWorkspace } from "@/lib/nav";

interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  originalPriceMinor: number;
  discountPriceMinor: number;
  currency: string;
  billingPeriod: string;
  badge?: string | null;
  features: string[];
  isPopular?: boolean;
}

interface CurrentSubscription {
  status: "ACTIVE" | "TRIAL" | "EXPIRED" | "CANCELLED" | "NONE";
  autoPayEnabled: boolean;
  paymentMethod?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  amountPaidMinor?: number;
  razorpaySubscriptionId?: string | null;
  plan?: SubscriptionPlan | null;
}

const DEFAULT_LAUNCH_PLAN: SubscriptionPlan = {
  id: "launch_offer_249",
  name: "Launch Special All-in-One",
  code: "launch_offer_249",
  originalPriceMinor: 104900,
  discountPriceMinor: 24900,
  currency: "INR",
  billingPeriod: "monthly",
  badge: "Special Launch Offer · 76% OFF",
  isPopular: true,
  features: [
    "Unlimited Students, Batches & Client Management",
    "Instant WhatsApp Receipts & Automated Due Reminders",
    "1-Click Attendance Tracker & Parent Alert Automation",
    "Staff Salary, Advance Tracking & Payroll Payslips",
    "Visual Inquiries Pipeline & Lead CRM with Call Reminders",
    "GST / Non-GST Invoicing & 1-Click Razorpay UPI Pay Links",
    "Mobile Web App Access for Staff, Trainers & Admins",
    "Automated Monthly UPI & Recurring Card Renewal",
    "Priority WhatsApp Onboarding & Excel Data Migration",
  ],
};

function SubscriptionContent() {
  const router = useRouter();
  const api = getApiUrl();
  const { orgName, userName, userRole, organisations, navItems } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([DEFAULT_LAUNCH_PLAN]);
  const [currentSub, setCurrentSub] = useState<CurrentSubscription | null>(null);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // 1. Load Razorpay Checkout JS
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!document.getElementById("razorpay-checkout-js")) {
      const script = document.createElement("script");
      script.id = "razorpay-checkout-js";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // 2. Fetch Plans & Current Subscription Status
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        setLoading(true);

        // Fetch Plans
        const plansRes = await fetch(`${api}/platform/public/plans`);
        if (plansRes.ok) {
          const plansData = await plansRes.json();
          const list = Array.isArray(plansData) ? plansData : Array.isArray(plansData?.plans) ? plansData.plans : [];
          if (list.length > 0 && !isCancelled) {
            setPlans(
              list.map((p: any) => ({
                id: p.id,
                name: p.name,
                code: p.code,
                originalPriceMinor: p.originalPriceMinor,
                discountPriceMinor: p.discountPriceMinor,
                currency: p.currency || "INR",
                billingPeriod: p.billingPeriod || "monthly",
                badge: p.badge,
                features: Array.isArray(p.features) ? p.features : [],
                isPopular: p.isPopular,
              }))
            );
          }
        }

        // Fetch Current Subscription
        const subRes = await authFetch(`${api}/subscriptions/current`);
        if (subRes.ok) {
          const subData = await subRes.json();
          if (!isCancelled) {
            const actualSub = subData.subscription || subData;
            setCurrentSub(actualSub);
          }
        }
      } catch (err: any) {
        console.error("Failed to load subscription data", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [api]);

  // 3. Initiate AutoPay via Razorpay Subscriptions
  const handleSubscribeAutoPay = async (plan: SubscriptionPlan) => {
    try {
      setProcessingPlanId(plan.id);
      setMessage(null);

      const createRes = await authFetch(`${api}/subscriptions/create-autopay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to initialize recurring subscription.");
      }

      const initData = await createRes.json();

      if (typeof window === "undefined" || !(window as any).Razorpay) {
        throw new Error("Razorpay payment gateway is loading. Please retry in a few seconds.");
      }

      // Configure Razorpay Options for Subscription / AutoPay Mode
      const options = {
        key: initData.razorpayKeyId,
        subscription_id: initData.subscriptionId,
        name: "CRMKaro",
        description: `Recurring AutoPay — ${initData.planName} (₹${Math.round(initData.amountMinor / 100)}/mo)`,
        image:
          typeof window !== "undefined" && window.location.protocol === "https:"
            ? "https://crmkaro.com/brand/crmkaro-mark.png"
            : undefined,
        prefill: {
          name: initData.orgName || orgName,
          email: initData.userEmail || "",
          contact: initData.userPhone || "",
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => {
            setProcessingPlanId(null);
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          try {
            setMessage({
              text: "Verifying UPI AutoPay mandate with NPCI & your bank...",
              type: "info",
            });

            const verifyRes = await authFetch(`${api}/subscriptions/verify-autopay`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                planId: plan.id,
                subscriptionId: response.razorpay_subscription_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) {
              const vErr = await verifyRes.json().catch(() => ({}));
              throw new Error(vErr.message || "AutoPay signature verification failed.");
            }

            const updatedSub = await verifyRes.json();
            setCurrentSub(updatedSub.subscription || updatedSub);
            setMessage({
              text: "🎉 Success! UPI AutoPay successfully activated. Your ₹249/mo Launch Offer is now live with automatic monthly renewals.",
              type: "success",
            });
          } catch (vErr: any) {
            setMessage({
              text: vErr.message || "Failed to confirm AutoPay subscription.",
              type: "error",
            });
          } finally {
            setProcessingPlanId(null);
          }
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setMessage({
        text: err.message || "An unexpected error occurred while starting AutoPay.",
        type: "error",
      });
      setProcessingPlanId(null);
    }
  };

  const isActive =
    currentSub?.status === "ACTIVE" ||
    Boolean((currentSub as any)?.hasActiveSubscription);

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/subscription"
      nav={navItems}
      userName={userName}
      userRole={userRole}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
      onPrefetch={(href) => router.prefetch(href)}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p className="eyebrow" style={{ color: "#2563eb", display: "flex", alignItems: "center", gap: 6, margin: "0 0 6px" }}>
              <Icon name="rupee" size={14} /> Subscription & Billing
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "var(--ink)" }}>
              Subscription & AutoPay Management
            </h1>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "4px 0 0" }}>
              Manage your monthly business plan, automated UPI e-mandates, and billing details.
            </p>
          </div>

          {isActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "8px 16px", borderRadius: 999 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>
                AutoPay Active (₹{Math.round((currentSub?.amountPaidMinor || 24900) / 100)}/mo)
              </span>
            </div>
          )}
        </div>

        {/* Message Banner */}
        {message && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background:
                message.type === "success"
                  ? "#ecfdf5"
                  : message.type === "error"
                  ? "#fef2f2"
                  : "#eff6ff",
              color:
                message.type === "success"
                  ? "#065f46"
                  : message.type === "error"
                  ? "#991b1b"
                  : "#1e40af",
              border: `1px solid ${
                message.type === "success"
                  ? "#a7f3d0"
                  : message.type === "error"
                  ? "#fecaca"
                  : "#bfdbfe"
              }`,
            }}
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 800 }}
              type="button"
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI / Current Status Overview */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <StatCard
            label="Current Plan"
            value="Launch Offer — All-in-One Business OS"
            change="Official Launch Offer"
            icon="tag"
          />
          <StatCard
            label="Monthly Price"
            value="₹249/mo"
            change="Special 76% Launch Rate"
            icon="rupee"
          />
          <StatCard
            label="Plan Status"
            value="ACTIVE 🟢"
            change="All Modules Unlocked"
            icon="shield"
          />
          <StatCard
            label="Billing Period"
            value={
              currentSub?.currentPeriodEnd
                ? new Date(currentSub.currentPeriodEnd).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Monthly Renewal"
            }
            change="Automatic monthly billing"
            icon="calendar"
          />
        </div>

        {/* ACTIVE PLAN & WORKSPACE ACCESS CARD */}
        <div
          style={{
            background: "var(--surface, #ffffff)",
            borderRadius: 16,
            border: "1px solid #10b981",
            boxShadow: "0 4px 16px -2px rgba(16, 185, 129, 0.08)",
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    background: "#ecfdf5",
                    color: "#059669",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  ACTIVE PLAN
                </span>
                <span style={{ fontSize: 11.5, color: "var(--muted, #64748b)", fontWeight: 600 }}>
                  Monthly Auto-Renewal
                </span>
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink, #0f172a)" }}>
                Launch Offer — All-in-One Business OS
              </h2>
              <p style={{ fontSize: 12, color: "var(--muted, #64748b)", margin: "3px 0 0" }}>
                Full access to student batches, daily attendance, staff payroll, sales CRM, and 1-click invoicing.
              </p>
            </div>

            <div style={{ textAlign: "right", background: "#f8fafc", padding: "8px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 10.5, color: "var(--muted, #64748b)", display: "block", fontWeight: 600 }}>Plan Price</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink, #0f172a)", lineHeight: 1.2 }}>
                ₹249<span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted, #64748b)" }}>/month</span>
              </div>
              <span style={{ fontSize: 10.5, color: "#059669", fontWeight: 700 }}>✓ Special Launch Rate</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--border, #e2e8f0)" }} />

          {/* Feature Highlights Grid */}
          <div>
            <h4 style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 800, color: "var(--muted, #64748b)", letterSpacing: "0.05em", margin: "0 0 10px" }}>
              Included Features & Workspace Access
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px 16px" }}>
              {[
                "Unlimited Students, Members & Customer Profiles",
                "1-Click WhatsApp PDF Receipts & Invoices",
                "Daily Batch Attendance & Parent WhatsApp Alerts",
                "Staff Salary Structures, Advance Tracking & Payslips",
                "GST / Non-GST Invoicing & Daily Expense Tracker",
                "Sales CRM Visual Pipelines & Follow-up Reminders",
                "Single-Tap Mobile Web & Computer Access",
                "Automatic Monthly Renewal via UPI & Cards",
              ].map((feature, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ink, #0f172a)", lineHeight: 1.4 }}>
                  <span style={{ color: "#10b981", display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <Icon name="check" size={13} />
                  </span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Status Footer Strip */}
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>🟢</span>
              <div>
                <strong style={{ fontSize: 12, color: "#065f46", display: "inline-block", marginRight: 6 }}>
                  Workspace Subscription is Active:
                </strong>
                <span style={{ fontSize: 11.5, color: "#047857" }}>
                  All business modules, student fee collectors, and CRM tools are fully unlocked.
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "#065f46",
                background: "#ffffff",
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #a7f3d0",
              }}
            >
              ✓ Active via Launch Offer (₹249/mo)
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <div className="state-spinner" />
        </div>
      }
    >
      <SubscriptionContent />
    </Suspense>
  );
}
