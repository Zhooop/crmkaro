"use client";

import { Badge, Icon, Modal, StatCard } from "@crmkaro/ui";
import { useCallback, useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

export type PlatformUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: "ACTIVE" | "DISABLED";
  signupPlatform: "WEB" | "MOBILE";
  lastPlatform: "WEB" | "MOBILE";
  isVerified: boolean;
  blockReason: string | null;
  blockedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  activeSessionsCount: number;
  organisations: Array<{ id: string; name: string; role: string }>;
};

type Props = {
  onFeedback: (msg: string, type: "success" | "error") => void;
};

export function UsersView({ onFeedback }: Props) {
  const api = getApiUrl();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | "WEB" | "MOBILE">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");

  // Block Modal State
  const [blockUser, setBlockUser] = useState<PlatformUser | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Inspect Modal State
  const [inspectUser, setInspectUser] = useState<PlatformUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (platformFilter !== "ALL") params.set("platform", platformFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await authFetch(`${api}/platform/users?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      onFeedback("Could not load users directory.", "error");
    } finally {
      setLoading(false);
    }
  }, [api, search, platformFilter, statusFilter, onFeedback]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleVerify = async (user: PlatformUser) => {
    try {
      const res = await authFetch(`${api}/platform/users/${user.id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified: !user.isVerified }),
      });
      if (!res.ok) throw new Error("Failed to update verification status");
      onFeedback(`User ${user.email} marked as ${!user.isVerified ? "Verified" : "Unverified"}.`, "success");
      fetchUsers();
    } catch {
      onFeedback("Error toggling verification.", "error");
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockUser) return;
    setSubmittingAction(true);
    try {
      const res = await authFetch(`${api}/platform/users/${blockUser.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DISABLED",
          blockReason: blockReason.trim() || "Suspended by Super Admin",
        }),
      });
      if (!res.ok) throw new Error("Failed to block user");
      onFeedback(`User ${blockUser.email} has been blocked and sessions revoked.`, "success");
      setBlockUser(null);
      setBlockReason("");
      fetchUsers();
    } catch {
      onFeedback("Could not block user.", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleUnblock = async (user: PlatformUser) => {
    try {
      const res = await authFetch(`${api}/platform/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (!res.ok) throw new Error("Failed to unblock user");
      onFeedback(`User ${user.email} has been unblocked.`, "success");
      fetchUsers();
    } catch {
      onFeedback("Could not unblock user.", "error");
    }
  };

  const totalUsers = users.length;
  const webUsersCount = users.filter((u) => u.signupPlatform === "WEB").length;
  const mobileUsersCount = users.filter((u) => u.signupPlatform === "MOBILE").length;
  const blockedUsersCount = users.filter((u) => u.status === "DISABLED").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Metrics Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard label="Total Users" value={totalUsers} icon="people" />
        <StatCard label="Web Signups" value={webUsersCount} icon="building" />
        <StatCard label="Mobile App Signups" value={mobileUsersCount} icon="activity" />
        <StatCard label="Suspended / Blocked" value={blockedUsersCount} icon="shield" />
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "#0f172a",
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid #1e293b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260 }}>
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Search users by name, email, or workspace…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Platform:</span>
          {(["ALL", "WEB", "MOBILE"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: platformFilter === p ? "#38bdf8" : "#1e293b",
                color: platformFilter === p ? "#0f172a" : "#94a3b8",
              }}
            >
              {p === "ALL" ? "All Platforms" : p === "WEB" ? "Web Only" : "Mobile App"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Status:</span>
          {(["ALL", "ACTIVE", "DISABLED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: statusFilter === s ? "#38bdf8" : "#1e293b",
                color: statusFilter === s ? "#0f172a" : "#94a3b8",
              }}
            >
              {s === "ALL" ? "All" : s === "ACTIVE" ? "Active" : "Blocked"}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading platform users…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No users match the search criteria.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#1e293b", color: "#94a3b8", borderBottom: "1px solid #334155" }}>
                  <th style={{ padding: "12px 16px" }}>User</th>
                  <th style={{ padding: "12px 16px" }}>First Origin</th>
                  <th style={{ padding: "12px 16px" }}>Last Active</th>
                  <th style={{ padding: "12px 16px" }}>Verified</th>
                  <th style={{ padding: "12px 16px" }}>Workspaces</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isBlocked = u.status === "DISABLED";
                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1px solid #1e293b",
                        background: isBlocked ? "rgba(220, 38, 38, 0.05)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "#334155",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: "#38bdf8",
                            }}
                          >
                            {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#f8fafc" }}>{u.name || "Anonymous"}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: u.signupPlatform === "MOBILE" ? "rgba(16, 185, 129, 0.15)" : "rgba(56, 189, 248, 0.15)",
                            color: u.signupPlatform === "MOBILE" ? "#10b981" : "#38bdf8",
                            border: `1px solid ${u.signupPlatform === "MOBILE" ? "#059669" : "#0284c7"}`,
                          }}
                        >
                          {u.signupPlatform === "MOBILE" ? "Mobile App" : "Web Portal"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 12, color: "#cbd5e1" }}>
                          {u.lastPlatform} · {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() => handleToggleVerify(u)}
                          style={{
                            cursor: "pointer",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                          }}
                          title="Click to toggle verification status"
                        >
                          {u.isVerified ? (
                            <Badge tone="green">Verified</Badge>
                          ) : (
                            <Badge tone="neutral">Unverified</Badge>
                          )}
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {u.organisations.length > 0 ? (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {u.organisations.map((org) => (
                              <span
                                key={org.id}
                                style={{
                                  background: "#1e293b",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontSize: 11,
                                  color: "#cbd5e1",
                                }}
                              >
                                {org.name} ({org.role})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: 12 }}>No Workspaces</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {isBlocked ? (
                          <Badge tone="red">Suspended</Badge>
                        ) : (
                          <Badge tone="green">Active</Badge>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button
                            className="secondary-btn"
                            onClick={() => setInspectUser(u)}
                            style={{ padding: "4px 8px", fontSize: 12, borderRadius: 6 }}
                          >
                            Inspect
                          </button>
                          {isBlocked ? (
                            <button
                              onClick={() => handleUnblock(u)}
                              style={{
                                padding: "4px 8px",
                                fontSize: 12,
                                borderRadius: 6,
                                background: "#065f46",
                                color: "#fff",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => setBlockUser(u)}
                              style={{
                                padding: "4px 8px",
                                fontSize: 12,
                                borderRadius: 6,
                                background: "#7f1d1d",
                                color: "#fff",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Block User
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Block Confirmation Modal */}
      {blockUser && (
        <Modal
          title={`Suspend / Block User: ${blockUser.email}`}
          isOpen={Boolean(blockUser)}
          onClose={() => setBlockUser(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>
              Warning: Blocking this user will immediately revoke all active web and mobile app sessions. They will not be able to log in.
            </p>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Reason for suspension:
              </label>
              <input
                type="text"
                placeholder="e.g. Terms violation, suspicious activity, customer request"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
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
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="secondary-btn" onClick={() => setBlockUser(null)}>
                Cancel
              </button>
              <button
                className="primary-btn"
                onClick={handleConfirmBlock}
                disabled={submittingAction}
                style={{ background: "#dc2626" }}
              >
                {submittingAction ? "Suspending…" : "Confirm & Revoke Sessions"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Inspect User Modal */}
      {inspectUser && (
        <Modal
          title={`User Telemetry & Profile: ${inspectUser.name || inspectUser.email}`}
          isOpen={Boolean(inspectUser)}
          onClose={() => setInspectUser(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 13 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "#1e293b", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>User ID</div>
                <div style={{ fontFamily: "monospace", color: "#38bdf8", wordBreak: "break-all" }}>{inspectUser.id}</div>
              </div>
              <div style={{ background: "#1e293b", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>Registered Email</div>
                <div style={{ fontWeight: 600, color: "#f8fafc" }}>{inspectUser.email}</div>
              </div>
              <div style={{ background: "#1e293b", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>First Acquisition Platform</div>
                <div style={{ fontWeight: 600, color: inspectUser.signupPlatform === "MOBILE" ? "#10b981" : "#38bdf8" }}>
                  {inspectUser.signupPlatform === "MOBILE" ? "Mobile App" : "Web Portal"}
                </div>
              </div>
              <div style={{ background: "#1e293b", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>Last Active Platform</div>
                <div style={{ fontWeight: 600, color: "#f8fafc" }}>{inspectUser.lastPlatform}</div>
              </div>
              <div style={{ background: "#1e293b", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>Member Since</div>
                <div style={{ color: "#cbd5e1" }}>{new Date(inspectUser.createdAt).toLocaleString()}</div>
              </div>
              <div style={{ background: "#1e293b", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>Active Sessions</div>
                <div style={{ color: "#cbd5e1" }}>{inspectUser.activeSessionsCount} concurrent sessions</div>
              </div>
            </div>

            {inspectUser.blockReason && (
              <div style={{ background: "rgba(220, 38, 38, 0.1)", border: "1px solid #dc2626", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 12 }}>Suspension Details</div>
                <div style={{ color: "#fca5a5" }}>{inspectUser.blockReason}</div>
                {inspectUser.blockedAt && (
                  <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>
                    Suspended on: {new Date(inspectUser.blockedAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            <div>
              <div style={{ fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>Linked Workspaces ({inspectUser.organisations.length})</div>
              {inspectUser.organisations.map((org) => (
                <div key={org.id} style={{ display: "flex", justifyContent: "space-between", background: "#1e293b", padding: 8, borderRadius: 6, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: "#f8fafc" }}>{org.name}</span>
                  <Badge tone="blue">{org.role}</Badge>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button className="secondary-btn" onClick={() => setInspectUser(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
