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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Broadcast Composer */}
      <div style={{ background: "#0f172a", padding: 20, borderRadius: 10, border: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Icon name="bell" size={18} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#f8fafc" }}>
            Direct Broadcast Console (Web & Mobile In-App Alerts)
          </h2>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#94a3b8" }}>
          Send important system announcements, festival offers, or security updates directly to all active users on Web and Mobile App.
        </p>

        <form onSubmit={handleBroadcast} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
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
                Notification Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
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
                <option value="OFFER">Special Offer</option>
                <option value="UPDATE">Product Update</option>
                <option value="SYSTEM_ALERT">Security / System Alert</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
                Target Audience
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
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
                <option value="ALL">All Users (Web + App)</option>
                <option value="WEB_ONLY">Web Users Only</option>
                <option value="MOBILE_ONLY">Mobile App Users Only</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
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
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 6,
                padding: "8px 12px",
                color: "#fff",
                fontSize: 13,
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
                Action Destination Link (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. /finance or crmkaro://offers"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
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

            <button
              type="submit"
              className="primary-btn"
              disabled={submitting || !title.trim() || !message.trim()}
              style={{ padding: "9px 24px", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Icon name="bell" size={15} />
              <span>{submitting ? "Broadcasting…" : "Send Broadcast Now"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Broadcast History */}
      <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e293b", fontWeight: 700, color: "#f8fafc", fontSize: 14 }}>
          Broadcast History & Sent Logs
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading broadcast history…</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No broadcasts sent yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#1e293b", color: "#94a3b8", borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "12px 16px" }}>Title & Message</th>
                <th style={{ padding: "12px 16px" }}>Type</th>
                <th style={{ padding: "12px 16px" }}>Target Audience</th>
                <th style={{ padding: "12px 16px" }}>Sent By</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Sent Date</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{n.message}</div>
                    {n.actionUrl && (
                      <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 2 }}>Link: {n.actionUrl}</div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge tone={n.type === "SYSTEM_ALERT" ? "red" : n.type === "OFFER" ? "green" : "blue"}>
                      {n.type}
                    </Badge>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge tone="neutral">{n.targetAudience}</Badge>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                    {n.sentByAdminEmail || "Platform Admin"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#94a3b8" }}>
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
