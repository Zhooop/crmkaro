"use client";

import { Badge, Icon, Modal } from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

export type PlatformBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  targetPlatform: "ALL" | "WEB" | "MOBILE";
  category: string;
  priority: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

type Props = {
  onFeedback: (msg: string, type: "success" | "error") => void;
};

export function CmsView({ onFeedback }: Props) {
  const api = getApiUrl();
  const [banners, setBanners] = useState<PlatformBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<"ALL" | "WEB" | "MOBILE">("ALL");

  // Create / Edit Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PlatformBanner | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [targetPlatform, setTargetPlatform] = useState<"ALL" | "WEB" | "MOBILE">("ALL");
  const [category, setCategory] = useState("ANNOUNCEMENT");
  const [priority, setPriority] = useState(0);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${api}/platform/banners`);
      if (!res.ok) throw new Error("Failed to load banners");
      const data = await res.json();
      setBanners(data.banners || []);
    } catch {
      onFeedback("Could not load banners.", "error");
    } finally {
      setLoading(false);
    }
  }, [api, onFeedback]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleToggleActive = async (banner: PlatformBanner) => {
    try {
      const res = await authFetch(`${api}/platform/banners/${banner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle banner status");
      onFeedback(`Banner is now ${!banner.isActive ? "Active" : "Inactive"}.`, "success");
      fetchBanners();
    } catch {
      onFeedback("Error toggling banner.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    try {
      const res = await authFetch(`${api}/platform/banners/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete banner");
      onFeedback("Banner deleted.", "success");
      fetchBanners();
    } catch {
      onFeedback("Error deleting banner.", "error");
    }
  };

  const openCreateModal = () => {
    setEditingBanner(null);
    setTitle("");
    setSubtitle("");
    setImageUrl("");
    setCtaLabel("");
    setCtaUrl("");
    setTargetPlatform("ALL");
    setCategory("ANNOUNCEMENT");
    setPriority(0);
    setCreateModalOpen(true);
  };

  const openEditModal = (b: PlatformBanner) => {
    setEditingBanner(b);
    setTitle(b.title);
    setSubtitle(b.subtitle || "");
    setImageUrl(b.imageUrl || "");
    setCtaLabel(b.ctaLabel || "");
    setCtaUrl(b.ctaUrl || "");
    setTargetPlatform(b.targetPlatform);
    setCategory(b.category);
    setPriority(b.priority);
    setCreateModalOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        targetPlatform,
        category,
        priority: Number(priority) || 0,
      };

      let res: Response;
      if (editingBanner) {
        res = await authFetch(`${api}/platform/banners/${editingBanner.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch(`${api}/platform/banners`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error("Failed to save banner");
      onFeedback(editingBanner ? "Banner updated successfully." : "Banner created successfully.", "success");
      setCreateModalOpen(false);
      fetchBanners();
    } catch {
      onFeedback("Failed to save banner.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBanners = banners.filter((b) => {
    if (filterPlatform === "ALL") return true;
    return b.targetPlatform === filterPlatform || b.targetPlatform === "ALL";
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Header Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          background: "#ffffff",
          padding: "12px 16px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a" }}>
            Content Management Studio (Banners & Promos)
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#64748b" }}>
            Publish announcements, festive offers, and maintenance banners directly to Web and Mobile applications.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 6, padding: 2, border: "1px solid #e2e8f0" }}>
            {(["ALL", "WEB", "MOBILE"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilterPlatform(p)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: filterPlatform === p ? "#0284c7" : "transparent",
                  color: filterPlatform === p ? "#ffffff" : "#475569",
                }}
              >
                {p === "ALL" ? "All" : p === "WEB" ? "Web" : "Mobile"}
              </button>
            ))}
          </div>

          <button
            className="primary-btn"
            onClick={openCreateModal}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12 }}
          >
            <Icon name="plus" size={14} />
            <span>Create New Banner</span>
          </button>
        </div>
      </div>

      {/* Live Preview Showcase */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0284c7", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="building" size={13} /> Web Top Announcement Preview
          </div>
          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: 6,
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ background: "#0284c7", color: "#fff", fontSize: 9.5, padding: "2px 5px", borderRadius: 4, fontWeight: 700, marginRight: 6 }}>
                {banners[0]?.category || "ANNOUNCEMENT"}
              </span>
              <span style={{ fontWeight: 600, color: "#0f172a", fontSize: 12 }}>
                {banners[0]?.title || "Welcome to CRMKaro Platform 2026!"}
              </span>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#475569" }}>
                {banners[0]?.subtitle || "Manage your school, gym, or business seamlessly on Web and Mobile."}
              </p>
            </div>
            {banners[0]?.ctaLabel && (
              <button style={{ background: "#0284c7", color: "#ffffff", border: "none", padding: "5px 10px", borderRadius: 5, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                {banners[0].ctaLabel}
              </button>
            )}
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="activity" size={13} /> Mobile App Hero Banner Preview
          </div>
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              padding: "10px 14px",
              maxWidth: 320,
              margin: "0 auto",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>
              Mobile Spotlight
            </div>
            <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 12.5, marginTop: 2 }}>
              {banners[0]?.title || "Download CRMKaro Mobile Companion"}
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              {banners[0]?.subtitle || "Instant attendance, fees reminders, and push notifications."}
            </div>
            <div style={{ marginTop: 8 }}>
              <span style={{ background: "#16a34a", color: "#ffffff", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 5 }}>
                {banners[0]?.ctaLabel || "Open Mobile App"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banners List */}
      <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>Loading banners…</div>
        ) : filteredBanners.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>
            No banners active. Click "+ Create New Banner" to publish one.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <th style={{ padding: "10px 14px" }}>Banner Details</th>
                <th style={{ padding: "10px 14px" }}>Category</th>
                <th style={{ padding: "10px 14px" }}>Target Platform</th>
                <th style={{ padding: "10px 14px" }}>Priority</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBanners.map((b) => (
                <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{b.title}</div>
                    {b.subtitle && <div style={{ fontSize: 11, color: "#64748b" }}>{b.subtitle}</div>}
                    {b.ctaLabel && (
                      <div style={{ fontSize: 10.5, color: "#0284c7", marginTop: 2 }}>
                        CTA: {b.ctaLabel} ({b.ctaUrl || "No Link"})
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <Badge tone="blue">{b.category}</Badge>
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <Badge tone={b.targetPlatform === "MOBILE" ? "green" : b.targetPlatform === "WEB" ? "blue" : "neutral"}>
                      {b.targetPlatform}
                    </Badge>
                  </td>
                  <td style={{ padding: "9px 14px", color: "#475569" }}>P-{b.priority}</td>
                  <td style={{ padding: "9px 14px" }}>
                    <button
                      onClick={() => handleToggleActive(b)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 10.5,
                        background: b.isActive ? "#dcfce7" : "#f1f5f9",
                        color: b.isActive ? "#16a34a" : "#64748b",
                      }}
                    >
                      {b.isActive ? "ACTIVE" : "PAUSED"}
                    </button>
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 5 }}>
                      <button
                        className="secondary-btn"
                        onClick={() => openEditModal(b)}
                        style={{ padding: "3px 8px", fontSize: 11.5 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        style={{
                          padding: "3px 8px",
                          fontSize: 11.5,
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: 5,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {createModalOpen && (
        <Modal
          title={editingBanner ? "Edit Platform Banner" : "Create New Platform Banner"}
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        >
          <form onSubmit={handleSaveBanner} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                Banner Headline / Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Festival Season Offer: 20% Off on Pro Plan!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "6px 10px",
                  color: "#0f172a",
                  fontSize: 12,
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                Subtitle / Descriptive Message
              </label>
              <input
                type="text"
                placeholder="e.g. Upgrade before October 31 to unlock multi-branch management"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "6px 10px",
                  color: "#0f172a",
                  fontSize: 12,
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                  Target Platform
                </label>
                <select
                  value={targetPlatform}
                  onChange={(e) => setTargetPlatform(e.target.value as any)}
                  style={{
                    width: "100%",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#0f172a",
                    fontSize: 12,
                  }}
                >
                  <option value="ALL">All (Web & Mobile)</option>
                  <option value="WEB">Web Portal Only</option>
                  <option value="MOBILE">Mobile App Only</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#0f172a",
                    fontSize: 12,
                  }}
                >
                  <option value="ANNOUNCEMENT">Announcement</option>
                  <option value="OFFER">Special Offer / Promo</option>
                  <option value="UPDATE">Product Update</option>
                  <option value="MAINTENANCE">Scheduled Maintenance</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                  CTA Button Text
                </label>
                <input
                  type="text"
                  placeholder="e.g. Claim Offer, View Details"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#0f172a",
                    fontSize: 12,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                  CTA Destination URL / Deep Link
                </label>
                <input
                  type="text"
                  placeholder="e.g. /settings/billing or crmkaro://plans"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#0f172a",
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button type="button" className="secondary-btn" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={submitting || !title.trim()}>
                {submitting ? "Publishing…" : editingBanner ? "Save Changes" : "Publish Banner"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
