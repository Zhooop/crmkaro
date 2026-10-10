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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Header Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          background: "#0f172a",
          padding: "16px 20px",
          borderRadius: 10,
          border: "1px solid #1e293b",
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#f8fafc" }}>
            Content Management Studio (Banners & Promos)
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Publish announcements, festive offers, and maintenance banners directly to Web and Mobile applications.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", background: "#1e293b", borderRadius: 8, padding: 3 }}>
            {(["ALL", "WEB", "MOBILE"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilterPlatform(p)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: filterPlatform === p ? "#38bdf8" : "transparent",
                  color: filterPlatform === p ? "#0f172a" : "#94a3b8",
                }}
              >
                {p === "ALL" ? "All" : p === "WEB" ? "Web" : "Mobile"}
              </button>
            ))}
          </div>

          <button
            className="primary-btn"
            onClick={openCreateModal}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="plus" size={15} />
            <span>Create New Banner</span>
          </button>
        </div>
      </div>

      {/* Live Preview Showcase */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#0f172a", padding: 16, borderRadius: 10, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="building" size={14} /> Web Top Announcement Preview
          </div>
          <div
            style={{
              background: "linear-gradient(90deg, #1e293b, #0f172a)",
              border: "1px solid #38bdf8",
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ background: "#0284c7", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 700, marginRight: 8 }}>
                {banners[0]?.category || "ANNOUNCEMENT"}
              </span>
              <span style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>
                {banners[0]?.title || "Welcome to CRMKaro Platform 2026!"}
              </span>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                {banners[0]?.subtitle || "Manage your school, gym, or business seamlessly on Web and Mobile."}
              </p>
            </div>
            {banners[0]?.ctaLabel && (
              <button style={{ background: "#38bdf8", color: "#0f172a", border: "none", padding: "6px 12px", borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                {banners[0].ctaLabel}
              </button>
            )}
          </div>
        </div>

        <div style={{ background: "#0f172a", padding: 16, borderRadius: 10, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="activity" size={14} /> Mobile App Hero Banner Preview
          </div>
          <div
            style={{
              background: "linear-gradient(135deg, #065f46, #022c22)",
              border: "1px solid #10b981",
              borderRadius: 12,
              padding: "14px 16px",
              maxWidth: 320,
              margin: "0 auto",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase" }}>
              Mobile Spotlight
            </div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 14, marginTop: 4 }}>
              {banners[0]?.title || "Download CRMKaro Mobile Companion"}
            </div>
            <div style={{ fontSize: 11, color: "#a7f3d0", marginTop: 2 }}>
              {banners[0]?.subtitle || "Instant attendance, fees reminders, and push notifications."}
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{ background: "#fff", color: "#065f46", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>
                {banners[0]?.ctaLabel || "Open Mobile App"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banners List */}
      <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading banners…</div>
        ) : filteredBanners.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            No banners active. Click "+ Create New Banner" to publish one.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#1e293b", color: "#94a3b8", borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "12px 16px" }}>Banner Details</th>
                <th style={{ padding: "12px 16px" }}>Category</th>
                <th style={{ padding: "12px 16px" }}>Target Platform</th>
                <th style={{ padding: "12px 16px" }}>Priority</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBanners.map((b) => (
                <tr key={b.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>{b.title}</div>
                    {b.subtitle && <div style={{ fontSize: 12, color: "#94a3b8" }}>{b.subtitle}</div>}
                    {b.ctaLabel && (
                      <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 2 }}>
                        CTA: {b.ctaLabel} ({b.ctaUrl || "No Link"})
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge tone="blue">{b.category}</Badge>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge tone={b.targetPlatform === "MOBILE" ? "green" : b.targetPlatform === "WEB" ? "blue" : "neutral"}>
                      {b.targetPlatform}
                    </Badge>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>P-{b.priority}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => handleToggleActive(b)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 11,
                        background: b.isActive ? "#065f46" : "#334155",
                        color: b.isActive ? "#34d399" : "#94a3b8",
                      }}
                    >
                      {b.isActive ? "ACTIVE" : "PAUSED"}
                    </button>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button
                        className="secondary-btn"
                        onClick={() => openEditModal(b)}
                        style={{ padding: "4px 8px", fontSize: 12 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        style={{
                          padding: "4px 8px",
                          fontSize: 12,
                          background: "#7f1d1d",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
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
          <form onSubmit={handleSaveBanner} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
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
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
                Subtitle / Descriptive Message
              </label>
              <input
                type="text"
                placeholder="e.g. Upgrade before October 31 to unlock multi-branch management"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                style={{
                  width: "100%",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
                  Target Platform
                </label>
                <select
                  value={targetPlatform}
                  onChange={(e) => setTargetPlatform(e.target.value as any)}
                  style={{
                    width: "100%",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontSize: 13,
                  }}
                >
                  <option value="ALL">All (Web & Mobile)</option>
                  <option value="WEB">Web Portal Only</option>
                  <option value="MOBILE">Mobile App Only</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontSize: 13,
                  }}
                >
                  <option value="ANNOUNCEMENT">Announcement</option>
                  <option value="OFFER">Special Offer / Promo</option>
                  <option value="UPDATE">Product Update</option>
                  <option value="MAINTENANCE">Scheduled Maintenance</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
                  CTA Button Text
                </label>
                <input
                  type="text"
                  placeholder="e.g. Claim Offer, View Details"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
                  CTA Destination URL / Deep Link
                </label>
                <input
                  type="text"
                  placeholder="e.g. /settings/billing or crmkaro://plans"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
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
