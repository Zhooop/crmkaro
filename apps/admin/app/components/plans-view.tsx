"use client";

import { Badge, Icon, Modal, StatCard } from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

export type SubscriptionPlanItem = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  originalPriceMinor: number;
  discountPriceMinor: number;
  currency: string;
  billingPeriod: string;
  billingInterval: number;
  badge: string | null;
  features: string[] | any;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  razorpayPlanId: string | null;
  createdAt: string;
};

type Props = {
  onFeedback: (msg: string, type: "success" | "error") => void;
};

export function PlansView({ onFeedback }: Props) {
  const api = getApiUrl();
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanItem | null>(null);
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState<SubscriptionPlanItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOriginalPrice, setFormOriginalPrice] = useState("1049");
  const [formDiscountPrice, setFormDiscountPrice] = useState("249");
  const [formBillingPeriod, setFormBillingPeriod] = useState("monthly");
  const [formBadge, setFormBadge] = useState("Special Launch Offer · 76% OFF");
  const [formFeatures, setFormFeatures] = useState<string[]>([
    "Unlimited Students, Members & Clients",
    "1-Click WhatsApp PDF Receipts & Invoices",
    "Daily Batch Attendance & Parent WhatsApp Alerts",
    "Staff Salary Structures & 1-Click Payslips",
    "GST Invoicing & Daily Kharcha Expense Tracker",
    "Sales CRM Visual Pipeline & Follow-up Reminders",
    "Single-Tap Mobile Web & Computer Access",
    "AutoPay Enabled (Monthly Auto-Renewal)",
  ]);
  const [newFeatureText, setNewFeatureText] = useState("");
  const [formIsPopular, setFormIsPopular] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState(1);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${api}/platform/plans`);
      if (!res.ok) throw new Error("Failed to load subscription plans");
      const data = await res.json();
      setPlans(data.plans || []);
    } catch {
      onFeedback("Could not load subscription plans.", "error");
    } finally {
      setLoading(false);
    }
  }, [api, onFeedback]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  function openCreateModal() {
    setEditingPlan(null);
    setFormName("Growth Business Plan");
    setFormCode(`plan_${Date.now().toString().slice(-4)}`);
    setFormDescription("For growing coaching institutes and expanding SMBs");
    setFormOriginalPrice("1049");
    setFormDiscountPrice("249");
    setFormBillingPeriod("monthly");
    setFormBadge("Launch Offer · 76% OFF");
    setFormFeatures([
      "Unlimited Students, Members & Clients",
      "1-Click WhatsApp PDF Receipts & Invoices",
      "Daily Batch Attendance & Parent WhatsApp Alerts",
      "Staff Salary Structures & 1-Click Payslips",
      "GST Invoicing & Daily Kharcha Expense Tracker",
      "Sales CRM Visual Pipeline & Follow-up Reminders",
      "AutoPay Enabled (Monthly Auto-Renewal)",
    ]);
    setFormIsPopular(true);
    setFormIsActive(true);
    setFormSortOrder(plans.length + 1);
    setModalOpen(true);
  }

  function openEditModal(plan: SubscriptionPlanItem) {
    setEditingPlan(plan);
    setFormName(plan.name);
    setFormCode(plan.code);
    setFormDescription(plan.description || "");
    setFormOriginalPrice(String(plan.originalPriceMinor / 100));
    setFormDiscountPrice(String(plan.discountPriceMinor / 100));
    setFormBillingPeriod(plan.billingPeriod || "monthly");
    setFormBadge(plan.badge || "");
    setFormFeatures(Array.isArray(plan.features) ? [...plan.features] : []);
    setFormIsPopular(plan.isPopular);
    setFormIsActive(plan.isActive);
    setFormSortOrder(plan.sortOrder || 1);
    setModalOpen(true);
  }

  function addFeatureItem() {
    if (!newFeatureText.trim()) return;
    setFormFeatures([...formFeatures, newFeatureText.trim()]);
    setNewFeatureText("");
  }

  function removeFeatureItem(index: number) {
    setFormFeatures(formFeatures.filter((_, i) => i !== index));
  }

  async function handleSavePlan() {
    if (!formName.trim()) {
      onFeedback("Plan Name is required.", "error");
      return;
    }

    const origMinor = Math.round(parseFloat(formOriginalPrice || "0") * 100);
    const discMinor = Math.round(parseFloat(formDiscountPrice || "0") * 100);

    if (discMinor <= 0) {
      onFeedback("Discount / Checkout Price must be greater than 0.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        code: formCode.trim() || undefined,
        description: formDescription.trim() || undefined,
        originalPriceMinor: origMinor,
        discountPriceMinor: discMinor,
        currency: "INR",
        billingPeriod: formBillingPeriod,
        billingInterval: 1,
        badge: formBadge.trim() || undefined,
        features: formFeatures,
        isPopular: formIsPopular,
        isActive: formIsActive,
        sortOrder: formSortOrder,
      };

      let res: Response;
      if (editingPlan) {
        res = await authFetch(`${api}/platform/plans/${editingPlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch(`${api}/platform/plans`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save subscription plan.");
      }

      onFeedback(
        editingPlan ? "Subscription plan updated successfully!" : "New subscription plan created successfully!",
        "success",
      );
      setModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      onFeedback(err.message || "Could not save plan.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(plan: SubscriptionPlanItem) {
    try {
      const res = await authFetch(`${api}/platform/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle plan status");
      onFeedback(`Plan ${plan.name} is now ${!plan.isActive ? "Active" : "Inactive"}.`, "success");
      fetchPlans();
    } catch {
      onFeedback("Could not update plan status.", "error");
    }
  }

  async function handleDeletePlan() {
    if (!deleteConfirmPlan) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`${api}/platform/plans/${deleteConfirmPlan.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete plan");
      onFeedback(`Plan ${deleteConfirmPlan.name} removed.`, "success");
      setDeleteConfirmPlan(null);
      fetchPlans();
    } catch {
      onFeedback("Could not delete plan.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const activePlansCount = plans.filter((p) => p.isActive).length;
  const launchPlan = plans.find((p) => p.code.includes("249") || p.discountPriceMinor === 24900) || plans[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Metric Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard label="Total Plans" value={plans.length} icon="finance" />
        <StatCard label="Active on Landing Page" value={activePlansCount} icon="checkCircle" />
        <StatCard
          label="Current Checkout Price"
          value={launchPlan ? `₹${(launchPlan.discountPriceMinor / 100).toLocaleString("en-IN")}/mo` : "₹249/mo"}
          icon="rupee"
        />
        <StatCard
          label="Original Listed Price"
          value={launchPlan ? `₹${(launchPlan.originalPriceMinor / 100).toLocaleString("en-IN")}` : "₹1,049"}
          icon="reports"
        />
      </div>

      {/* Action Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          padding: "12px 16px",
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--ink, #0f172a)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>Subscription & Pricing Plans Manager</span>
            <Badge tone="green">Live Landing Page Sync</Badge>
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--muted, #64748b)" }}>
            Configure the subscription pricing plans shown on CRMKaro.com. Whatever price you set here is what users are charged on Razorpay AutoPay.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontWeight: 700, fontSize: 12 }}
          type="button"
        >
          <Icon name="plus" size={14} />
          <span>+ Create New Subscription Plan</span>
        </button>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
          <div className="state-spinner" style={{ margin: "0 auto 10px" }} />
          Loading subscription plans…
        </div>
      ) : plans.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>No subscription plans found.</p>
          <button onClick={openCreateModal} className="btn btn-primary btn-sm" type="button" style={{ marginTop: 8, fontSize: 12 }}>
            Create Launch Offer (₹249/mo)
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {plans.map((plan) => {
            const orig = plan.originalPriceMinor / 100;
            const disc = plan.discountPriceMinor / 100;
            const discountPercent = orig > disc ? Math.round(((orig - disc) / orig) * 100) : 0;
            const featuresList = Array.isArray(plan.features) ? plan.features : [];

            return (
              <div
                key={plan.id}
                style={{
                  background: "#ffffff",
                  borderRadius: 10,
                  border: plan.isPopular ? "2px solid #0284c7" : "1px solid #e2e8f0",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  boxShadow: plan.isPopular ? "0 6px 18px -4px rgba(2,132,199,0.12)" : "0 1px 3px rgba(0,0,0,0.03)",
                  opacity: plan.isActive ? 1 : 0.65,
                }}
              >
                {/* Popular or Custom Badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  {plan.badge ? (
                    <span
                      style={{
                        background: plan.isPopular ? "#f0f9ff" : "#f1f5f9",
                        color: plan.isPopular ? "#0284c7" : "#475569",
                        border: plan.isPopular ? "1px solid #bae6fd" : "1px solid #e2e8f0",
                        padding: "2px 8px",
                        borderRadius: 20,
                        fontSize: 10.5,
                        fontWeight: 750,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {plan.badge}
                    </span>
                  ) : <div />}

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Badge tone={plan.isActive ? "green" : "neutral"}>
                      {plan.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 4px", color: "var(--ink, #0f172a)" }}>
                  {plan.name}
                </h3>
                {plan.description && (
                  <p style={{ fontSize: 12, color: "var(--muted, #64748b)", margin: "0 0 12px", lineHeight: 1.4 }}>
                    {plan.description}
                  </p>
                )}

                {/* Price Display */}
                <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, margin: "8px 0 14px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    {orig > disc && (
                      <span style={{ fontSize: 13, color: "#94a3b8", textDecoration: "line-through", fontWeight: 600 }}>
                        ₹{orig.toLocaleString("en-IN")}
                      </span>
                    )}
                    <span style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em" }}>
                      ₹{disc.toLocaleString("en-IN")}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                      /{plan.billingPeriod || "month"}
                    </span>
                    {discountPercent > 0 && (
                      <span
                        style={{
                          marginLeft: "auto",
                          background: "#ecfdf5",
                          color: "#059669",
                          border: "1px solid #a7f3d0",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10.5,
                          fontWeight: 800,
                        }}
                      >
                        {discountPercent}% OFF
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#059669", fontWeight: 700, marginTop: 3 }}>
                    ⚡ Recurring AutoPay Enabled (Direct Bank/UPI Mandate)
                  </div>
                </div>

                {/* Features Bullet List */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, margin: "8px 0 16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 750, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.05em" }}>
                    Included Features ({featuresList.length}):
                  </span>
                  {featuresList.map((feat: string, idx: number) => (
                    <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "#334155" }}>
                      <span style={{ color: "#0284c7", fontWeight: 800, marginTop: 1 }}>✓</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Card Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                  <button
                    onClick={() => openEditModal(plan)}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, fontWeight: 700, fontSize: 11.5, padding: "5px 10px" }}
                    type="button"
                  >
                    Edit Plan
                  </button>

                  <button
                    onClick={() => handleToggleStatus(plan)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "5px 10px", fontSize: 11.5, color: plan.isActive ? "#d97706" : "#059669" }}
                    type="button"
                    title={plan.isActive ? "Deactivate plan" : "Activate plan"}
                  >
                    {plan.isActive ? "Disable" : "Enable"}
                  </button>

                  <button
                    onClick={() => setDeleteConfirmPlan(plan)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "5px 8px", color: "#dc2626" }}
                    type="button"
                    title="Delete plan"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT PLAN MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPlan ? `Edit Subscription Plan: ${editingPlan.name}` : "Create New Subscription Plan"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#334155" }}>
                Plan Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Launch Offer — All-in-One Business OS"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#334155" }}>
                Plan Code / Identifier
              </label>
              <input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. launch_offer_249"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#334155" }}>
              Short Tagline / Description
            </label>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="e.g. Complete business operating system at introductory launch pricing"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#334155" }}>
                Original Price (₹) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="number"
                value={formOriginalPrice}
                onChange={(e) => setFormOriginalPrice(e.target.value)}
                placeholder="1049"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
              <span style={{ fontSize: 11, color: "#64748b" }}>Shown strikethrough (~~₹1,049~~)</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#334155" }}>
                Checkout Price (₹) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="number"
                value={formDiscountPrice}
                onChange={(e) => setFormDiscountPrice(e.target.value)}
                placeholder="249"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #2563eb", fontSize: 13, fontWeight: 700 }}
              />
              <span style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>Amount charged via AutoPay</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#334155" }}>
                Billing Cycle
              </label>
              <select
                value={formBillingPeriod}
                onChange={(e) => setFormBillingPeriod(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#334155" }}>
              Badge Tag Label
            </label>
            <input
              value={formBadge}
              onChange={(e) => setFormBadge(e.target.value)}
              placeholder="e.g. Special Launch Offer · 76% OFF or Most Popular"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
            />
          </div>

          {/* Features Builder */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#334155" }}>
              Plan Features / Bullet Points ({formFeatures.length})
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={newFeatureText}
                onChange={(e) => setNewFeatureText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFeatureItem();
                  }
                }}
                placeholder="Type a feature and press Enter or Add..."
                style={{ flex: 1, padding: "7px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
              <button onClick={addFeatureItem} className="btn btn-secondary btn-sm" type="button" style={{ fontWeight: 700 }}>
                + Add Bullet
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", padding: 4 }}>
              {formFeatures.map((feat, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    background: "#f8fafc",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    fontSize: 12.5,
                  }}
                >
                  <span>✓ {feat}</span>
                  <button
                    onClick={() => removeFeatureItem(index)}
                    type="button"
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Flags */}
          <div style={{ display: "flex", gap: 20, paddingTop: 6, borderTop: "1px solid #f1f5f9" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formIsPopular}
                onChange={(e) => setFormIsPopular(e.target.checked)}
              />
              <span>Mark as Featured / Most Popular</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
              />
              <span>Active on Live Landing Page</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button
              onClick={() => setModalOpen(false)}
              className="btn btn-secondary"
              type="button"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePlan}
              className="btn btn-primary"
              type="button"
              disabled={submitting}
              style={{ fontWeight: 750, padding: "8px 20px" }}
            >
              {submitting ? "Saving Plan…" : editingPlan ? "Update Plan" : "Publish Plan"}
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deleteConfirmPlan)}
        onClose={() => setDeleteConfirmPlan(null)}
        title="Confirm Plan Deletion"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
            Are you sure you want to delete the plan <strong>{deleteConfirmPlan?.name}</strong>?
            Existing active subscriptions on this plan will remain valid.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={() => setDeleteConfirmPlan(null)} className="btn btn-secondary" type="button">
              Cancel
            </button>
            <button
              onClick={handleDeletePlan}
              className="btn btn-primary"
              style={{ background: "#dc2626", borderColor: "#dc2626" }}
              type="button"
              disabled={submitting}
            >
              {submitting ? "Deleting…" : "Delete Plan"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
