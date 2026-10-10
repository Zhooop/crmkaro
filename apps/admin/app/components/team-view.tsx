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
            Admin Team & RBAC Permissions
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Manage Super-Admin team credentials, assign granular module permissions, and audit admin activities.
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={() => setAddModalOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Icon name="plus" size={15} />
          <span>Add Admin Member</span>
        </button>
      </div>

      {/* Role Explanations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {ROLES_INFO.map((r) => (
          <div key={r.role} style={{ background: "#0f172a", padding: 14, borderRadius: 8, border: "1px solid #1e293b" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: "#f8fafc", fontSize: 13 }}>{r.name}</span>
              <Badge tone={r.badge as any}>{r.role}</Badge>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12, margin: 0, lineHeight: 1.4 }}>{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Team Members Table */}
      <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading team members…</div>
        ) : members.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No team members found.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#1e293b", color: "#94a3b8", borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "12px 16px" }}>Team Member</th>
                <th style={{ padding: "12px 16px" }}>Assigned Role</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Added Date</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{m.email}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
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
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => handleToggleActive(m)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 11,
                        background: m.isActive ? "#065f46" : "#334155",
                        color: m.isActive ? "#34d399" : "#94a3b8",
                      }}
                    >
                      {m.isActive ? "ACTIVE" : "DISABLED"}
                    </button>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    {m.email !== "admin@crmkaro.com" && (
                      <button
                        onClick={() => handleDelete(m.id)}
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
          <form onSubmit={handleAddMember} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
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
                Role & Assigned Permissions *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
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
                <option value="SUPPORT_ADMIN">Support & Operations Executive (User Management, Verify/Block)</option>
                <option value="FINANCE_ADMIN">Finance & Accounts Auditor (Payments, Refunds, Reports)</option>
                <option value="CONTENT_ADMIN">Content & Marketing Manager (Banners, Broadcasts)</option>
                <option value="SUPER_ADMIN">Super Administrator (Full Unrestricted Access)</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
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
