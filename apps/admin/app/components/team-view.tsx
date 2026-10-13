"use client";

import { Badge, Icon, Modal } from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

export type PlatformTeamMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type Props = {
  onFeedback: (msg: string, type: "success" | "error") => void;
};

const ROLES_INFO = [
  {
    role: "SUPER_ADMIN",
    name: "Super Administrator",
    badge: "red",
    desc: "Unrestricted access across all tenant databases, team members, finance, and system operations.",
  },
  {
    role: "FINANCE_ADMIN",
    name: "Finance & Accounts Auditor",
    badge: "blue",
    desc: "Access to Transactions, Payments & Refunds ledger, and Financial Business Reports.",
  },
  {
    role: "SUPPORT_ADMIN",
    name: "Support & Operations Executive",
    badge: "green",
    desc: "Access to User Directory (View, Verify, Suspend/Unblock), Tenant Overview, and Audit Logs.",
  },
  {
    role: "CONTENT_ADMIN",
    name: "Content & Marketing Manager",
    badge: "neutral",
    desc: "Access to CMS & Banners Studio and Broadcast Notifications to Web & Mobile users.",
  },
];

export function TeamView({ onFeedback }: Props) {
  const api = getApiUrl();
  const [members, setMembers] = useState<PlatformTeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Member Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("SUPPORT_ADMIN");
  const [submitting, setSubmitting] = useState(false);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${api}/platform/team`);
      if (!res.ok) throw new Error("Failed to load team members");
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      onFeedback("Could not load admin team.", "error");
    } finally {
      setLoading(false);
    }
  }, [api, onFeedback]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleToggleActive = async (member: PlatformTeamMember) => {
    try {
      const res = await authFetch(`${api}/platform/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      onFeedback(`Member access ${!member.isActive ? "activated" : "deactivated"}.`, "success");
      fetchTeam();
    } catch {
      onFeedback("Could not update member status.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this admin team member?")) return;
    try {
      const res = await authFetch(`${api}/platform/team/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete member");
      onFeedback("Team member removed.", "success");
      fetchTeam();
    } catch {
      onFeedback("Could not remove team member.", "error");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`${api}/platform/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          role,
        }),
      });
      if (!res.ok) throw new Error("Failed to add member");
      onFeedback(`Team member ${name} invited successfully as ${role}.`, "success");
      setEmail("");
      setName("");
      setRole("SUPPORT_ADMIN");
      setAddModalOpen(false);
      fetchTeam();
    } catch {
      onFeedback("Failed to add admin member.", "error");
    } finally {
      setSubmitting(false);
    }
  };

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
            Admin Team & RBAC Permissions
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#64748b" }}>
            Manage Super-Admin team credentials, assign granular module permissions, and audit admin activities.
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={() => setAddModalOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12 }}
        >
          <Icon name="plus" size={14} />
          <span>Add Admin Member</span>
        </button>
      </div>

      {/* Role Explanations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {ROLES_INFO.map((r) => (
          <div key={r.role} style={{ background: "#ffffff", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 12 }}>{r.name}</span>
              <Badge tone={r.badge as any}>{r.role}</Badge>
            </div>
            <p style={{ color: "#64748b", fontSize: 11, margin: 0, lineHeight: 1.4 }}>{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Team Members Table */}
      <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>Loading team members…</div>
        ) : members.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>No team members found.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <th style={{ padding: "10px 14px" }}>Team Member</th>
                <th style={{ padding: "10px 14px" }}>Assigned Role</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
                <th style={{ padding: "10px 14px" }}>Added Date</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{m.email}</div>
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <Badge
                      tone={
                        m.role === "SUPER_ADMIN"
                          ? "red"
                          : m.role === "FINANCE_ADMIN"
                          ? "blue"
                          : m.role === "SUPPORT_ADMIN"
                          ? "green"
                          : "neutral"
                      }
                    >
                      {m.role}
                    </Badge>
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <button
                      onClick={() => handleToggleActive(m)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 10.5,
                        background: m.isActive ? "#dcfce7" : "#f1f5f9",
                        color: m.isActive ? "#16a34a" : "#64748b",
                      }}
                    >
                      {m.isActive ? "ACTIVE" : "DISABLED"}
                    </button>
                  </td>
                  <td style={{ padding: "9px 14px", color: "#475569" }}>
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>
                    {m.email !== "admin@crmkaro.com" && (
                      <button
                        onClick={() => handleDelete(m.id)}
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
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Member Modal */}
      {addModalOpen && (
        <Modal title="Add Platform Admin Team Member" isOpen={addModalOpen} onClose={() => setAddModalOpen(false)}>
          <form onSubmit={handleAddMember} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                Corporate Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="e.g. ramesh@crmkaro.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                Role & Assigned Permissions *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
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
                <option value="SUPPORT_ADMIN">Support & Operations Executive (User Management, Verify/Block)</option>
                <option value="FINANCE_ADMIN">Finance & Accounts Auditor (Payments, Refunds, Reports)</option>
                <option value="CONTENT_ADMIN">Content & Marketing Manager (Banners, Broadcasts)</option>
                <option value="SUPER_ADMIN">Super Administrator (Full Unrestricted Access)</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button type="button" className="secondary-btn" onClick={() => setAddModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={submitting || !email.trim() || !name.trim()}>
                {submitting ? "Inviting…" : "Invite Admin Member"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
