"use client";

import { Badge, Icon } from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

export type PlatformNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  targetAudience: string;
  actionUrl: string | null;
  sentByAdminEmail: string | null;
  createdAt: string;
};

type Props = {
  onFeedback: (msg: string, type: "success" | "error") => void;
};

export function NotificationsView({ onFeedback }: Props) {
  const api = getApiUrl();
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("ANNOUNCEMENT");
  const [targetAudience, setTargetAudience] = useState("ALL");
  const [actionUrl, setActionUrl] = useState("");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${api}/platform/notifications`);
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      onFeedback("Could not load notification history.", "error");
    } finally {
      setLoading(false);
    }
  }, [api, onFeedback]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`${api}/platform/notifications/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          type,
          targetAudience,
          actionUrl: actionUrl.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to send broadcast");
      onFeedback(`Broadcast sent to ${targetAudience} users successfully!`, "success");
      setTitle("");
      setMessage("");
      setActionUrl("");
      fetchNotifications();
    } catch {
      onFeedback("Could not send broadcast notification.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Broadcast Composer */}
      <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <Icon name="bell" size={16} />
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a" }}>
            Direct Broadcast Console (Web & Mobile In-App Alerts)
          </h2>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 11.5, color: "#64748b" }}>
          Send important system announcements, festival offers, or security updates directly to all active users on Web and Mobile App.
        </p>

        <form onSubmit={handleBroadcast} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                Notification Headline / Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Scheduled Maintenance Tonight at 11 PM"
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
                Notification Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
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
                <option value="OFFER">Special Offer</option>
                <option value="UPDATE">Product Update</option>
                <option value="SYSTEM_ALERT">Security / System Alert</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                Target Audience
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
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
                <option value="ALL">All Users (Web + App)</option>
                <option value="WEB_ONLY">Web Users Only</option>
                <option value="MOBILE_ONLY">Mobile App Users Only</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
              Notification Body / Message *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Enter message details that will appear on user screen..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: "100%",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                padding: "6px 10px",
                color: "#0f172a",
                fontSize: 12,
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                Action Destination Link (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. /finance or crmkaro://offers"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
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

            <button
              type="submit"
              className="primary-btn"
              disabled={submitting || !title.trim() || !message.trim()}
              style={{ padding: "7px 18px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
            >
              <Icon name="bell" size={14} />
              <span>{submitting ? "Broadcasting…" : "Send Broadcast Now"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Broadcast History */}
      <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#0f172a", fontSize: 13, background: "#f8fafc" }}>
          Broadcast History & Sent Logs
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>Loading broadcast history…</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>No broadcasts sent yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <th style={{ padding: "10px 14px" }}>Title & Message</th>
                <th style={{ padding: "10px 14px" }}>Type</th>
                <th style={{ padding: "10px 14px" }}>Target Audience</th>
                <th style={{ padding: "10px 14px" }}>Sent By</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Sent Date</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{n.title}</div>
                    <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{n.message}</div>
                    {n.actionUrl && (
                      <div style={{ fontSize: 11, color: "#0284c7", marginTop: 2 }}>Link: {n.actionUrl}</div>
                    )}
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <Badge tone={n.type === "SYSTEM_ALERT" ? "red" : n.type === "OFFER" ? "green" : "blue"}>
                      {n.type}
                    </Badge>
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <Badge tone="neutral">{n.targetAudience}</Badge>
                  </td>
                  <td style={{ padding: "9px 14px", color: "#475569" }}>
                    {n.sentByAdminEmail || "Platform Admin"}
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: "#64748b" }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
