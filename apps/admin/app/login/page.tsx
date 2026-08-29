"use client";

import { Icon } from "@crmkaro/ui";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const api =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" && window.location.hostname.endsWith("crmkaro.com")
      ? "https://api.crmkaro.com/api/v1"
      : "http://localhost:4000/api/v1");

  async function handleAdminLogin(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter both Admin Email ID and Password.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const res = await fetch(`${api}/auth/admin/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid administrator credentials. Access denied.");
      }

      router.replace("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page admin-auth">
      <section className="auth-story">
        <div className="brand-row">
          <div className="brand-mark">
            <img src="/brand/crmkaro-mark.png" alt="CRMKaro Logo" />
          </div>
          <div>
            <strong style={{ color: "#ffffff" }}>CRMKaro Admin</strong>
            <span>Restricted Platform Operations Console</span>
          </div>
        </div>

        <div className="auth-story-body">
          <p className="eyebrow">
            <Icon name="shield" size={14} />
            AUTHORISED PERSONNEL ONLY
          </p>
          <h1>Operate the platform securely.</h1>
          <p>
            Platform access is strictly isolated with PostgreSQL Row-Level Security,
            multi-tenant monitoring, and immutable audit trails.
          </p>

          <div className="auth-security-badges">
            <span className="security-chip">
              <Icon name="shield" size={13} />
              <span>RLS Tenant Isolation</span>
            </span>
            <span className="security-chip">
              <Icon name="checkCircle" size={13} />
              <span>Append-Only Audit</span>
            </span>
            <span className="security-chip">
              <Icon name="activity" size={13} />
              <span>Real-Time Observability</span>
            </span>
          </div>
        </div>

        <div className="auth-story-visual" aria-hidden="true">
          <img src="/brand/crmkaro-admin-hero.jpg" alt="CRMKaro Admin Console" />
          <span className="auth-visual-pill pill-one">⚡ Live Platform Metrics</span>
          <span className="auth-visual-pill pill-two">🔒 256-Bit Encrypted Session</span>
        </div>

        <small className="auth-story-footer">
          CRMKaro Platform Engine · Zero-Trust Access Architecture
        </small>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-form-card" style={{ maxWidth: 440 }}>
          <form className="auth-form" onSubmit={handleAdminLogin}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: 20, color: "#38bdf8", fontSize: 11, fontWeight: 700, marginBottom: 12 }}>
              <Icon name="shield" size={13} />
              <span>SUPER ADMIN CONSOLE</span>
            </div>

            <h2>Platform Sign In</h2>
            <p>
              Sign in with your verified platform administrator ID & password.
            </p>

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 16,
                  border: "1px solid #fca5a5",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="admin-email" style={{ fontSize: 12, fontWeight: 700 }}>
                  Admin ID / Email *
                </label>
                <input
                  id="admin-email"
                  type="email"
                  placeholder="admin@crmkaro.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    fontSize: 13.5,
                    outline: "none",
                  }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                  <label htmlFor="admin-password" style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>
                    Admin Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {showPassword ? "Hide" : "Show"} Password
                  </button>
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter administrator password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    fontSize: 13.5,
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                className="primary-button"
                disabled={busy}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "12px",
                  fontSize: 13.5,
                  fontWeight: 700,
                  marginTop: 6,
                  borderRadius: 10,
                }}
              >
                {busy ? (
                  <span>Authenticating…</span>
                ) : (
                  <>
                    <Icon name="shield" size={15} />
                    <span>Authenticate & Access Console</span>
                  </>
                )}
              </button>
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--muted)",
                fontSize: 11.5,
              }}
            >
              <Icon name="alertCircle" size={14} />
              <span>All access attempts are cryptographically logged & monitored.</span>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
