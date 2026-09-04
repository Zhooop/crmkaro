"use client";

import { Badge, Icon, Modal } from "@crmkaro/ui";
import { useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

type LeadSettings = {
  id: string;
  webhookApiKey: string;
  notifyEmails: string | null;
  sendLeadEmailAlert: boolean;
  sendCustomerWelcomeEmail: boolean;
  welcomeEmailSubject: string | null;
  welcomeEmailBody: string | null;
};

interface LeadCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgName?: string;
}

export function LeadCaptureModal({ isOpen, onClose, orgName }: LeadCaptureModalProps) {
  const api = getApiUrl();
  const [activeTab, setActiveTab] = useState<"alerts" | "webhook" | "embed">("alerts");

  const [settings, setSettings] = useState<LeadSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form states
  const [notifyEmails, setNotifyEmails] = useState("");
  const [sendLeadEmailAlert, setSendLeadEmailAlert] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadSettings() {
      try {
        setLoading(true);
        setStatusMessage(null);
        const res = await authFetch(`${api}/crm/lead-settings`);
        if (res.ok) {
          const data: LeadSettings = await res.json();
          if (mounted) {
            setSettings(data);
            setNotifyEmails(data.notifyEmails || "");
            setSendLeadEmailAlert(data.sendLeadEmailAlert);
          }
        }
      } catch (err: any) {
        if (mounted) setStatusMessage({ text: "Failed to load lead settings.", type: "error" });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadSettings();

    return () => {
      mounted = false;
    };
  }, [isOpen, api]);

  const handleSaveAlerts = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      setStatusMessage(null);
      const res = await authFetch(`${api}/crm/lead-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyEmails: notifyEmails.trim() || null,
          sendLeadEmailAlert,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setStatusMessage({ text: "Notification settings saved successfully!", type: "success" });
      } else {
        setStatusMessage({ text: "Failed to save settings.", type: "error" });
      }
    } catch {
      setStatusMessage({ text: "Network error while saving settings.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    const emailToTest = notifyEmails.trim() || "";
    if (!emailToTest) {
      setStatusMessage({ text: "Please enter at least one email address to send a test alert.", type: "error" });
      return;
    }

    try {
      setTesting(true);
      setStatusMessage(null);
      const res = await authFetch(`${api}/crm/lead-settings/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToTest }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.status === "failed") {
          setStatusMessage({
            text: result.message || "Failed to send test email. Check your SMTP settings.",
            type: "error",
          });
        } else {
          setStatusMessage({
            text: result.message || `Test lead alert sent to ${emailToTest}! Check your inbox.`,
            type: "success",
          });
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatusMessage({ text: errData.message || "Failed to send test email.", type: "error" });
      }
    } catch {
      setStatusMessage({ text: "Error triggering test email.", type: "error" });
    } finally {
      setTesting(false);
    }
  };

  const captureUrl = settings
    ? `${typeof window !== "undefined" ? window.location.origin.replace("3000", "4000") : "https://api.crmkaro.com"}/api/v1/leads/capture?key=${settings.webhookApiKey}`
    : "";

  const handleCopyUrl = () => {
    if (!captureUrl) return;
    navigator.clipboard.writeText(captureUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lead Capture & Instant Email Alerts"
      subtitle={orgName ? `${orgName} · Zero-Third-Party Automation` : "In-House Lead Engine"}
      maxWidth={700}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "alerts" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("alerts")}
          >
            <Icon name="mail" size={14} />
            <span>1. Instant Email Alerts</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "webhook" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("webhook")}
          >
            <Icon name="zap" size={14} />
            <span>2. Facebook & Webhook API</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "embed" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("embed")}
          >
            <Icon name="externalLink" size={14} />
            <span>3. Embed Website Form</span>
          </button>
        </div>

        {statusMessage && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: statusMessage.type === "success" ? "#f0fdf4" : "#fef2f2",
              color: statusMessage.type === "success" ? "#15803d" : "#b91c1c",
              border: `1px solid ${statusMessage.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>
            <div className="state-spinner" style={{ margin: "0 auto 12px" }} />
            <p>Loading lead engine preferences…</p>
          </div>
        ) : (
          <>
            {/* TAB 1: EMAIL ALERTS */}
            {activeTab === "alerts" && (
              <form onSubmit={handleSaveAlerts} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#f8fafc", padding: "14px 18px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>
                        Instant Real-Time Email Notifications
                      </strong>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        Receive formatted lead alerts (with 1-Click WhatsApp & Call buttons) the moment someone inquires.
                      </span>
                    </div>
                    <label style={{ position: "relative", display: "inline-block", width: 44, height: 24 }}>
                      <input
                        type="checkbox"
                        checked={sendLeadEmailAlert}
                        onChange={(e) => setSendLeadEmailAlert(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          cursor: "pointer",
                          inset: 0,
                          backgroundColor: sendLeadEmailAlert ? "#2563eb" : "#cbd5e1",
                          borderRadius: 24,
                          transition: "0.2s",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            height: 18,
                            width: 18,
                            left: sendLeadEmailAlert ? 22 : 3,
                            bottom: 3,
                            backgroundColor: "white",
                            borderRadius: "50%",
                            transition: "0.2s",
                          }}
                        />
                      </span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                    Email Address(es) to Receive Lead Alerts
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. rajeshrealty@gmail.com, sales@rajeshrealty.com"
                    value={notifyEmails}
                    onChange={(e) => setNotifyEmails(e.target.value)}
                    style={{ fontSize: 13.5 }}
                  />
                  <small style={{ color: "var(--muted)", fontSize: 11, marginTop: 4, display: "block" }}>
                    Separate multiple emails with commas. All telecallers or partners listed will get instant notification.
                  </small>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSendTestEmail}
                    disabled={testing}
                  >
                    <Icon name="mail" size={14} />
                    <span>{testing ? "Sending Test..." : "Send Test Email"}</span>
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={saving}
                  >
                    <span>{saving ? "Saving..." : "Save Preferences"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: WEBHOOK API */}
            {activeTab === "webhook" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                  Connect <strong>Facebook Lead Ads</strong>, <strong>Instagram Forms</strong>, <strong>Google Sheets</strong>, or custom listing portals directly. When an ad is submitted, it lands instantly on your Kanban Board.
                </p>

                <div style={{ background: "#0f172a", borderRadius: 12, padding: "14px 16px", color: "#f8fafc" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <small style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                      Your Unique Ingestion Webhook URL
                    </small>
                    <Badge tone="green">Ready & Active</Badge>
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      wordBreak: "break-all",
                      background: "rgba(255,255,255,0.08)",
                      padding: "8px 12px",
                      borderRadius: 6,
                      color: "#38bdf8",
                    }}
                  >
                    {captureUrl}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleCopyUrl}
                    style={{
                      marginTop: 10,
                      background: copied ? "#22c55e" : "#ffffff",
                      color: copied ? "#ffffff" : "#0f172a",
                      fontWeight: 700,
                      fontSize: 12,
                      width: "100%",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={copied ? "checkCircle" : "copy"} size={14} />
                    <span>{copied ? "Copied to Clipboard!" : "Copy Webhook URL"}</span>
                  </button>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <strong style={{ fontSize: 12.5, color: "#0f172a", display: "block", marginBottom: 4 }}>
                    Supported JSON Fields:
                  </strong>
                  <pre style={{ margin: 0, fontSize: 11.5, color: "#334155", background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0", overflowX: "auto" }}>
{`{
  "name": "Amit Sharma",
  "phone": "9876543210",
  "email": "amit@gmail.com",
  "source": "Facebook Ad - Noida 3BHK",
  "expectedValueMinor": 8500000,
  "notes": "Looking for 3BHK corner unit"
}`}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB 3: EMBED FORM */}
            {activeTab === "embed" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                  Copy-paste this ready-made HTML form into your WordPress site, landing page, or Webflow. Leads will flow into CRMKaro with zero backend coding required.
                </p>

                <div style={{ background: "#0f172a", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <small style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                      HTML Form Snippet
                    </small>
                  </div>
                  <pre
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11.5,
                      color: "#e2e8f0",
                      background: "rgba(255,255,255,0.06)",
                      padding: 12,
                      borderRadius: 8,
                      overflowX: "auto",
                      margin: 0,
                    }}
                  >
{`<form action="${captureUrl}" method="POST">
  <input type="text" name="name" placeholder="Full Name" required />
  <input type="tel" name="phone" placeholder="Phone Number" required />
  <input type="email" name="email" placeholder="Email Address" />
  <input type="text" name="source" value="Website Inquiry Form" hidden />
  <textarea name="notes" placeholder="Inquiry details..."></textarea>
  <button type="submit">Submit Inquiry</button>
</form>`}
                  </pre>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      const snippet = `<form action="${captureUrl}" method="POST">\n  <input type="text" name="name" placeholder="Full Name" required />\n  <input type="tel" name="phone" placeholder="Phone Number" required />\n  <input type="email" name="email" placeholder="Email Address" />\n  <input type="text" name="source" value="Website Inquiry Form" hidden />\n  <textarea name="notes" placeholder="Inquiry details..."></textarea>\n  <button type="submit">Submit Inquiry</button>\n</form>`;
                      navigator.clipboard.writeText(snippet);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    }}
                    style={{
                      marginTop: 10,
                      background: "#ffffff",
                      color: "#0f172a",
                      fontWeight: 700,
                      fontSize: 12,
                      width: "100%",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={copied ? "checkCircle" : "copy"} size={14} />
                    <span>{copied ? "Copied Form Snippet!" : "Copy HTML Form Snippet"}</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
