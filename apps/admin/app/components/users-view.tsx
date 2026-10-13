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

  // Delete User Modal State
  const [deleteUser, setDeleteUser] = useState<PlatformUser | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (!deleteUser) return;
    setSubmittingDelete(true);
    try {
      const res = await authFetch(`${api}/platform/users/${deleteUser.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete user");
      }
      onFeedback(`User ${deleteUser.email} has been permanently deleted.`, "success");
      setDeleteUser(null);
      if (inspectUser?.id === deleteUser.id) setInspectUser(null);
      fetchUsers();
    } catch (err) {
      onFeedback((err as Error).message, "error");
    } finally {
      setSubmittingDelete(false);
    }
  };

  const totalUsers = users.length;
  const webUsersCount = users.filter((u) => u.signupPlatform === "WEB").length;
  const mobileUsersCount = users.filter((u) => u.signupPlatform === "MOBILE").length;
  const blockedUsersCount = users.filter((u) => u.status === "DISABLED").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Metrics Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
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
          gap: 10,
          background: "#ffffff",
          padding: "12px 14px",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 240 }}>
          <Icon name="search" size={14} />
          <input
            type="text"
            placeholder="Search users by name, email, or workspace…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Platform:</span>
          {(["ALL", "WEB", "MOBILE"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 600,
                border: "1px solid " + (platformFilter === p ? "#0284c7" : "#e2e8f0"),
                cursor: "pointer",
                background: platformFilter === p ? "#0284c7" : "#ffffff",
                color: platformFilter === p ? "#ffffff" : "#475569",
              }}
            >
              {p === "ALL" ? "All Platforms" : p === "WEB" ? "Web Only" : "Mobile App"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Status:</span>
          {(["ALL", "ACTIVE", "DISABLED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 600,
                border: "1px solid " + (statusFilter === s ? "#0284c7" : "#e2e8f0"),
                cursor: "pointer",
                background: statusFilter === s ? "#0284c7" : "#ffffff",
                color: statusFilter === s ? "#ffffff" : "#475569",
              }}
            >
              {s === "ALL" ? "All" : s === "ACTIVE" ? "Active" : "Blocked"}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>Loading platform users…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 12 }}>No users match the search criteria.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  <th style={{ padding: "10px 14px" }}>User</th>
                  <th style={{ padding: "10px 14px" }}>First Origin</th>
                  <th style={{ padding: "10px 14px" }}>Last Active</th>
                  <th style={{ padding: "10px 14px" }}>Verified</th>
                  <th style={{ padding: "10px 14px" }}>Workspaces</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isBlocked = u.status === "DISABLED";
                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: isBlocked ? "#fef2f2" : "#ffffff",
                      }}
                    >
                      <td style={{ padding: "9px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: "#e0f2fe",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: "#0284c7",
                              fontSize: 11,
                              flexShrink: 0,
                            }}
                          >
                            {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 12 }}>{u.name || "Anonymous"}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        <span
                          style={{
                            padding: "2px 7px",
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 700,
                            background: u.signupPlatform === "MOBILE" ? "#dcfce7" : "#e0f2fe",
                            color: u.signupPlatform === "MOBILE" ? "#16a34a" : "#0284c7",
                            border: `1px solid ${u.signupPlatform === "MOBILE" ? "#bbf7d0" : "#bae6fd"}`,
                          }}
                        >
                          {u.signupPlatform === "MOBILE" ? "Mobile App" : "Web Portal"}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ fontSize: 11.5, color: "#475569" }}>
                          {u.lastPlatform} · {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px" }}>
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
                      <td style={{ padding: "9px 14px" }}>
                        {u.organisations.length > 0 ? (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {u.organisations.map((org) => (
                              <span
                                key={org.id}
                                style={{
                                  background: "#f1f5f9",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontSize: 10.5,
                                  color: "#334155",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                {org.name} ({org.role})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 11.5 }}>No Workspaces</span>
                        )}
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        {isBlocked ? (
                          <Badge tone="red">Suspended</Badge>
                        ) : (
                          <Badge tone="green">Active</Badge>
                        )}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                          <button
                            className="secondary-btn"
                            onClick={() => setInspectUser(u)}
                            style={{ padding: "3px 8px", fontSize: 11.5, borderRadius: 5 }}
                          >
                            Inspect
                          </button>
                          {isBlocked ? (
                            <button
                              onClick={() => handleUnblock(u)}
                              style={{
                                padding: "3px 8px",
                                fontSize: 11.5,
                                borderRadius: 5,
                                background: "#16a34a",
                                color: "#ffffff",
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
                                padding: "3px 8px",
                                fontSize: 11.5,
                                borderRadius: 5,
                                background: "#dc2626",
                                color: "#ffffff",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Block
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteUser(u)}
                            title="Delete user account permanently"
                            style={{
                              padding: "3px 8px",
                              fontSize: 11.5,
                              borderRadius: 5,
                              background: "#fef2f2",
                              color: "#dc2626",
                              border: "1px solid #fecaca",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Delete
                          </button>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ color: "#dc2626", fontSize: 12, margin: 0, lineHeight: 1.4 }}>
              Warning: Blocking this user will immediately revoke all active web and mobile app sessions. They will not be able to log in.
            </p>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
                Reason for suspension:
              </label>
              <input
                type="text"
                placeholder="e.g. Terms violation, suspicious activity, customer request"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  padding: "7px 10px",
                  color: "#0f172a",
                  fontSize: 12,
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ color: "#64748b", fontSize: 10.5 }}>User ID</div>
                <div style={{ fontFamily: "monospace", color: "#0284c7", wordBreak: "break-all", fontWeight: 600, fontSize: 11 }}>{inspectUser.id}</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ color: "#64748b", fontSize: 10.5 }}>Registered Email</div>
                <div style={{ fontWeight: 600, color: "#0f172a" }}>{inspectUser.email}</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ color: "#64748b", fontSize: 10.5 }}>First Acquisition Platform</div>
                <div style={{ fontWeight: 600, color: inspectUser.signupPlatform === "MOBILE" ? "#16a34a" : "#0284c7" }}>
                  {inspectUser.signupPlatform === "MOBILE" ? "Mobile App" : "Web Portal"}
                </div>
              </div>
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ color: "#64748b", fontSize: 10.5 }}>Last Active Platform</div>
                <div style={{ fontWeight: 600, color: "#0f172a" }}>{inspectUser.lastPlatform}</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ color: "#64748b", fontSize: 10.5 }}>Member Since</div>
                <div style={{ color: "#334155" }}>{new Date(inspectUser.createdAt).toLocaleString()}</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ color: "#64748b", fontSize: 10.5 }}>Active Sessions</div>
                <div style={{ color: "#334155" }}>{inspectUser.activeSessionsCount} concurrent sessions</div>
              </div>
            </div>

            {inspectUser.blockReason && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 10, borderRadius: 6 }}>
                <div style={{ color: "#dc2626", fontWeight: 700, fontSize: 11.5 }}>Suspension Details</div>
                <div style={{ color: "#991b1b" }}>{inspectUser.blockReason}</div>
                {inspectUser.blockedAt && (
                  <div style={{ color: "#64748b", fontSize: 10.5, marginTop: 4 }}>
                    Suspended on: {new Date(inspectUser.blockedAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            <div>
              <div style={{ fontWeight: 600, color: "#475569", marginBottom: 6, fontSize: 11.5 }}>Linked Workspaces ({inspectUser.organisations.length})</div>
              {inspectUser.organisations.map((org) => (
                <div key={org.id} style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: "6px 10px", borderRadius: 6, marginBottom: 4, border: "1px solid #e2e8f0" }}>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{org.name}</span>
                  <Badge tone="blue">{org.role}</Badge>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                onClick={() => setDeleteUser(inspectUser)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 11.5,
                }}
              >
                Permanently Delete User Account
              </button>
              <button className="secondary-btn" onClick={() => setInspectUser(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteUser && (
        <Modal
          title={`Delete User: ${deleteUser.email}`}
          isOpen={Boolean(deleteUser)}
          onClose={() => {
            if (!submittingDelete) setDeleteUser(null);
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                padding: "10px 12px",
                borderRadius: 6,
                color: "#991b1b",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ display: "block", color: "#dc2626", marginBottom: 3 }}>
                ⚠️ Irreversible Account Deletion
              </strong>
              This will permanently delete <strong>{deleteUser.email}</strong>, revoke active sessions, clear OTP challenges, and free up their email so you can test sign-up & onboarding again from scratch.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button
                className="secondary-btn"
                disabled={submittingDelete}
                onClick={() => setDeleteUser(null)}
              >
                Cancel
              </button>
              <button
                className="primary-btn"
                onClick={handleConfirmDelete}
                disabled={submittingDelete}
                style={{ background: "#dc2626" }}
              >
                {submittingDelete ? "Deleting…" : "Confirm Permanent Deletion"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
