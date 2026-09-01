"use client";

import {
  AppShell,
  Badge,
  EmptyState,
  Icon,
  Modal,
  Tabs,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import {
  buildNavItems,
  useWorkspaceContext,
  DEFAULT_SERVICE_CODES,
  getCachedWorkspaceContext,
  saveCachedWorkspaceContext,
  saveActiveServicesToStorage,
} from "@/lib/nav";

type GroupItem = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string;
  feeAmountMinor: number;
  feeFrequency: string;
  billingType: string;
  collectionDay: string | null;
  startDate: string;
  endDate: string | null;
  workingDays: string;
  isActive: boolean;
  totalMembers: number;
  totalActiveMembers: number;
  totalDueMinor: number;
  createdAt: string;
};

type GroupMemberDetail = {
  id: string;
  personId: string;
  displayName: string;
  primaryPhone: string | null;
  alternatePhone: string | null;
  email: string | null;
  status: string;
  customFeeMinor: number;
  startDate: string;
  dueAmountMinor: number;
  paidAmountMinor: number;
  recentInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    totalMinor: number;
    balanceDueMinor: number;
    status: string;
    issueDate: string;
  }>;
};

type GroupDetail = GroupItem & {
  totalCollectedMinor: number;
  members: GroupMemberDetail[];
};

type PersonOption = {
  id: string;
  displayName: string;
  primaryPhone: string | null;
  email: string | null;
};

const WORKING_DAYS_OPTIONS = [
  { key: "S", label: "S", full: "Sun" },
  { key: "M", label: "M", full: "Mon" },
  { key: "T", label: "T", full: "Tue" },
  { key: "W", label: "W", full: "Wed" },
  { key: "Th", label: "T", full: "Thu" },
  { key: "F", label: "F", full: "Fri" },
  { key: "Sa", label: "S", full: "Sat" },
];

const COLLECTION_DAYS = [
  "1st day of month",
  "5th day of month",
  "10th day of month",
  "15th day of month",
  "20th day of month",
  "25th day of month",
  "28th day of month",
  "Last day of month",
];

const PASTEL_COLORS = [
  { bg: "#dbeafe", text: "#1e40af" }, // Blue
  { bg: "#ffedd5", text: "#9a3412" }, // Orange
  { bg: "#f3e8ff", text: "#6b21a8" }, // Purple
  { bg: "#f1f5f9", text: "#334155" }, // Slate
  { bg: "#ecfdf5", text: "#065f46" }, // Emerald
  { bg: "#fef3c7", text: "#92400e" }, // Amber
  { bg: "#ffe4e6", text: "#9f1239" }, // Rose
];

function formatCurrency(minor: number): string {
  return "₹ " + (minor / 100).toLocaleString("en-IN");
}

function GroupsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = getApiUrl();

  // Page View Modes: "list" | "new" | "detail"
  const [viewMode, setViewMode] = useState<"list" | "new" | "detail">("list");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeGroupTab, setActiveGroupTab] = useState<string>("dashboard");

  // Context & AppShell info (Instant 0ms cached state)
  const { context: cached, isMounted, nav: defaultNav } = useWorkspaceContext();
  const [orgName, setOrgName] = useState("CRMKaro Workspace");
  const [userName, setUserName] = useState("Workspace User");
  const [userRole, setUserRole] = useState("Owner");
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);
  const [activeServiceCodes, setActiveServiceCodes] = useState<string[]>(DEFAULT_SERVICE_CODES);

  useEffect(() => {
    if (isMounted) {
      setOrgName(cached.orgName);
      setUserName(cached.userName);
      setUserRole(cached.userRole);
      setActiveServiceCodes(cached.activeServices);
    }
  }, [isMounted, cached]);

  // Groups List States
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");

  // Group Detail State
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [insightMonth, setInsightMonth] = useState("September 2026");

  // New Group Wizard States
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupFeeAmount, setGroupFeeAmount] = useState<number>(600);
  const [groupCollectionDay, setGroupCollectionDay] = useState("1st day of month");
  const [groupStartDate, setGroupStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [groupEndDate, setGroupEndDate] = useState("");
  const [groupWorkingDays, setGroupWorkingDays] = useState<string[]>(["T", "Th", "Sa"]);
  const [groupColorIndex, setGroupColorIndex] = useState(0);

  // Wizard Step 2: Member Selection
  const [allPeople, setAllPeople] = useState<PersonOption[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<
    Map<string, { customFeeMinor: number; startDate: string }>
  >(new Map());
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardError, setWizardError] = useState("");

  // Edit Group Modal
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Add Member to existing group Modal
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [singleMemberPersonId, setSingleMemberPersonId] = useState("");
  const [singleMemberCustomFee, setSingleMemberCustomFee] = useState<number>(600);
  const [addMemberBusy, setAddMemberBusy] = useState(false);

  // Load user session & current active org info
  const loadContext = useCallback(async () => {
    try {
      const meRes = await authFetch(`${api}/auth/me`, { credentials: "include" });
      if (meRes.status === 401) {
        router.replace("/login");
        return;
      }
      const orgsRes = await authFetch(`${api}/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgList = await orgsRes.json();
        const activeOrgEntry = orgList.find(
          (o: { organisation: { id: string; name: string } | null; role: { name: string } }) =>
            o.organisation,
        );
        if (activeOrgEntry?.organisation) {
          setOrgName(activeOrgEntry.organisation.name);
          setUserRole(activeOrgEntry.role?.name || "Member");
          const srvs = activeOrgEntry.activeServices || activeOrgEntry.organisation.activeServices;
          if (srvs && Array.isArray(srvs)) {
            setActiveServiceCodes(srvs);
            saveActiveServicesToStorage(srvs);
          }
        }
        setOrganisations(
          orgList
            .map((o: { organisation: { id: string; name: string; businessType?: string } }) => o.organisation)
            .filter(Boolean),
        );
      }
    } catch {
      // ignore
    }
  }, [api, router]);

  // Load Groups List
  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await authFetch(`${api}/groups?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load groups.");
      const data = await res.json();
      setGroups(data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter]);

  // Load Single Group Detail
  const loadGroupDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      try {
        const res = await authFetch(`${api}/groups/${id}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load group details.");
        const data = await res.json();
        setGroupDetail(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setDetailLoading(false);
      }
    },
    [api],
  );

  // Load all people for member selector
  const loadPeople = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/people?limit=200`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAllPeople(
          (data.items || []).map((p: any) => ({
            id: p.id,
            displayName: p.displayName,
            primaryPhone: p.primaryPhone,
            email: p.email,
          })),
        );
      }
    } catch {
      // ignore
    }
  }, [api]);

  useEffect(() => {
    loadContext();
    loadPeople();
  }, [loadContext, loadPeople]);

  useEffect(() => {
    if (viewMode === "list") {
      loadGroups();
    }
  }, [viewMode, loadGroups]);

  useEffect(() => {
    if (selectedGroupId && viewMode === "detail") {
      loadGroupDetail(selectedGroupId);
    }
  }, [selectedGroupId, viewMode, loadGroupDetail]);

  // Check URL query param for open actions
  useEffect(() => {
    const action = searchParams.get("action");
    const id = searchParams.get("id");
    if (action === "new") {
      resetWizard();
      setViewMode("new");
    } else if (id) {
      setSelectedGroupId(id);
      setViewMode("detail");
    }
  }, [searchParams]);

  function resetWizard() {
    setWizardStep(1);
    setGroupName("");
    setGroupCode("");
    setGroupDescription("");
    setGroupFeeAmount(600);
    setGroupCollectionDay("1st day of month");
    setGroupStartDate(new Date().toISOString().split("T")[0] || "");
    setGroupEndDate("");
    setGroupWorkingDays(["T", "Th", "Sa"]);
    setGroupColorIndex(Math.floor(Math.random() * PASTEL_COLORS.length));
    setSelectedMembers(new Map());
    setWizardError("");
  }

  function handleDayToggle(dayKey: string) {
    setGroupWorkingDays((curr) =>
      curr.includes(dayKey) ? curr.filter((d) => d !== dayKey) : [...curr, dayKey],
    );
  }

  function toggleMemberSelection(personId: string) {
    setSelectedMembers((curr) => {
      const next = new Map(curr);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.set(personId, {
          customFeeMinor: (groupFeeAmount || 0) * 100,
          startDate: groupStartDate || new Date().toISOString().split("T")[0] || "",
        });
      }
      return next;
    });
  }

  function selectAllFilteredMembers(filtered: PersonOption[]) {
    setSelectedMembers((curr) => {
      const next = new Map(curr);
      const allSelected = filtered.every((p) => next.has(p.id));
      if (allSelected) {
        filtered.forEach((p) => next.delete(p.id));
      } else {
        filtered.forEach((p) => {
          if (!next.has(p.id)) {
            next.set(p.id, {
              customFeeMinor: (groupFeeAmount || 0) * 100,
              startDate: groupStartDate || new Date().toISOString().split("T")[0] || "",
            });
          }
        });
      }
      return next;
    });
  }

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) {
      setWizardError("Please enter a group name.");
      return;
    }
    setWizardBusy(true);
    setWizardError("");
    try {
      const membersPayload = Array.from(selectedMembers.entries()).map(([personId, m]) => ({
        personId,
        customFeeMinor: m.customFeeMinor,
        startDate: m.startDate,
      }));

      const res = await authFetch(`${api}/groups`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          code: groupCode.trim() || undefined,
          description: groupDescription.trim() || undefined,
          color: PASTEL_COLORS[groupColorIndex]?.bg || "#dbeafe",
          feeAmountMinor: (groupFeeAmount || 0) * 100,
          feeFrequency: "MONTHLY",
          billingType: "Fixed",
          collectionDay: groupCollectionDay,
          startDate: groupStartDate || undefined,
          endDate: groupEndDate || undefined,
          workingDays: groupWorkingDays.join(","),
          members: membersPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create group.");

      setSelectedGroupId(data.id);
      setViewMode("detail");
    } catch (err) {
      setWizardError((err as Error).message);
    } finally {
      setWizardBusy(false);
    }
  }

  async function handleToggleGroupStatus(groupId: string, currentActive: boolean) {
    try {
      const res = await authFetch(`${api}/groups/${groupId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) {
        if (groupDetail && groupDetail.id === groupId) {
          setGroupDetail({ ...groupDetail, isActive: !currentActive });
        }
        loadGroups();
      }
    } catch {
      // ignore
    }
  }

  async function handleAddSingleMember(e: FormEvent) {
    e.preventDefault();
    if (!groupDetail || !singleMemberPersonId) return;
    setAddMemberBusy(true);
    try {
      const res = await authFetch(`${api}/groups/${groupDetail.id}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personId: singleMemberPersonId,
          customFeeMinor: (singleMemberCustomFee || 0) * 100,
          startDate: new Date().toISOString().split("T")[0],
        }),
      });
      if (res.ok) {
        setAddMemberModalOpen(false);
        setSingleMemberPersonId("");
        loadGroupDetail(groupDetail.id);
      }
    } catch {
      // ignore
    } finally {
      setAddMemberBusy(false);
    }
  }

  async function handleRemoveMember(personId: string) {
    if (!groupDetail || !confirm("Are you sure you want to remove this member from the group?")) return;
    try {
      const res = await authFetch(`${api}/groups/${groupDetail.id}/members/${personId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        loadGroupDetail(groupDetail.id);
      }
    } catch {
      // ignore
    }
  }

  const nav: NavItem[] = buildNavItems(activeServiceCodes);

  const filteredPeople = allPeople.filter(
    (p) =>
      p.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (p.primaryPhone && p.primaryPhone.includes(memberSearch)) ||
      (p.email && p.email.toLowerCase().includes(memberSearch.toLowerCase())),
  );

  const navItems: NavItem[] = isMounted ? buildNavItems(activeServiceCodes) : defaultNav;

  return (
    <AppShell
      product="CRMKaro"
      organisation={isMounted ? orgName : "CRMKaro Workspace"}
      organisations={organisations}
      currentPath="/groups"
      nav={navItems}
      userName={isMounted ? userName : "Workspace User"}
      userRole={isMounted ? userRole : "Owner"}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
      onPrefetch={(href) => router.prefetch(href)}
    >
      {/* =========================================================================
          VIEW 1: GROUPS GRID / LIST VIEW (Screenshot 1)
          ========================================================================= */}
      {viewMode === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header */}
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                <Icon name="activity" size={14} /> Batches & Rosters
              </p>
              <h1>Active Groups</h1>
            </div>

            <div className="toolbar-actions">
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{ width: 140 }}
              >
                <option value="ACTIVE">Active groups</option>
                <option value="INACTIVE">Inactive groups</option>
                <option value="ALL">All groups</option>
              </select>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  resetWizard();
                  setViewMode("new");
                }}
                style={{ background: "#059669", borderColor: "#059669", fontWeight: 700 }}
              >
                <Icon name="plus" size={15} />
                <span>New Group</span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="toolbar">
            <div className="search-box" style={{ maxWidth: 420 }}>
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Search by group name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="btn-icon" onClick={() => setSearch("")}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Groups Content */}
          {loading ? (
            <div className="empty-state">
              <div className="state-spinner" />
              <p>Loading groups & batches…</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <Icon name="alertCircle" size={28} />
              <h3>Error Loading Groups</h3>
              <p>{error}</p>
            </div>
          ) : groups.length === 0 ? (
            <EmptyState
              icon="activity"
              title="No groups found"
              description={
                search
                  ? "No groups matched your search query."
                  : "Organize students, members or learners into batches to manage fees and attendance."
              }
              actionLabel="Create First Group"
              onAction={() => {
                resetWizard();
                setViewMode("new");
              }}
            />
          ) : (
            <div className="groups-grid">
              {groups.map((group, idx) => {
                const colorTheme = PASTEL_COLORS[idx % PASTEL_COLORS.length] ?? { bg: "#dbeafe", text: "#1e40af" };
                return (
                  <div
                    key={group.id}
                    className="group-card"
                    onClick={() => {
                      setSelectedGroupId(group.id);
                      setViewMode("detail");
                    }}
                  >
                    {/* Large Monogram Banner */}
                    <div
                      className="group-monogram-banner"
                      style={{
                        background: group.color || colorTheme.bg,
                        color: colorTheme.text,
                      }}
                    >
                      <span>{group.code}</span>
                    </div>

                    {/* Card Body */}
                    <div className="group-card-body">
                      <div className="group-card-title-row">
                        <div>
                          <h4 className="group-card-title">{group.name}</h4>
                          <span className="group-card-members">
                            {group.totalActiveMembers}
                            {group.totalMembers > group.totalActiveMembers
                              ? `/${group.totalMembers}`
                              : ""}{" "}
                            Active Members
                          </span>
                        </div>

                        <button
                          className="btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGroupId(group.id);
                            setViewMode("detail");
                          }}
                          title="Manage Group"
                        >
                          <Icon name="filter" size={15} />
                        </button>
                      </div>

                      {/* Total Due Row */}
                      <div className="group-card-due-row">
                        <span className="group-card-due-label">
                          <span className="group-due-dot" />
                          <span>Total Due Amount</span>
                        </span>
                        <strong className="group-card-due-amount">
                          {formatCurrency(group.totalDueMinor)}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: NEW GROUP WIZARD (Screenshots 2, 3, 4)
          ========================================================================= */}
      {viewMode === "new" && (
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          {/* Wizard Header Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (wizardStep === 2) {
                  setWizardStep(1);
                } else {
                  setViewMode("list");
                }
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", fontSize: 16, fontWeight: 750, color: "var(--ink)", padding: 0 }}
            >
              <span>← New group</span>
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewMode("list")}
              >
                Cancel
              </button>
              {wizardStep === 1 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!groupName.trim()}
                  onClick={() => setWizardStep(2)}
                  style={{ background: "#059669", borderColor: "#059669", fontWeight: 700 }}
                >
                  Save and next
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={wizardBusy}
                  onClick={handleCreateGroup}
                  style={{ background: "#059669", borderColor: "#059669", fontWeight: 700 }}
                >
                  {wizardBusy ? "Saving Group…" : "Save"}
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="group-wizard-progress">
            <div className={`group-wizard-step ${wizardStep >= 1 ? "active" : ""} ${wizardStep === 2 ? "done" : ""}`}>
              <div className="group-wizard-step-dot">
                {wizardStep === 2 ? "✓" : "1"}
              </div>
              <span>Basic details</span>
            </div>

            <div className={`group-wizard-line ${wizardStep === 2 ? "active" : ""}`} />

            <div className={`group-wizard-step ${wizardStep === 2 ? "active" : ""}`}>
              <div className="group-wizard-step-dot">2</div>
              <span>Add members</span>
            </div>
          </div>

          {wizardError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12.5, marginBottom: 16 }}>
              ⚠️ {wizardError}
            </div>
          )}

          {/* STEP 1: BASIC DETAILS (Screenshot 2) */}
          {wizardStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Card 1: Name & Avatar */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 22,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                {/* Avatar Placeholder */}
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 12,
                    border: "1.5px dashed #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#059669",
                    background: "#f8fafc",
                    fontSize: 22,
                  }}
                >
                  <span>+</span>
                </div>

                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Eg: Dance Class A"
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      if (!groupCode) {
                        const parts = e.target.value.trim().split(/[\s-_]+/);
                        if (parts.length >= 2 && parts[0] && parts[1]) {
                          setGroupCode(`${parts[0][0]}${parts[1][0]}`.toUpperCase());
                        } else if (parts[0]) {
                          setGroupCode(parts[0].slice(0, 2).toUpperCase());
                        }
                      }
                    }}
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1.5px solid #059669",
                      fontSize: 14.5,
                      fontWeight: 600,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Card 2: Fee Details */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 750, color: "var(--ink)", margin: 0 }}>
                  Fee details
                </h3>

                {/* Collection Day */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                    When do you want to collect fees? <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={groupCollectionDay}
                    onChange={(e) => setGroupCollectionDay(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, background: "#fff" }}
                  >
                    {COLLECTION_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Activation & Deactivation Dates */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                      Group Activation Date <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={groupStartDate}
                      onChange={(e) => setGroupStartDate(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}
                    />
                    <small style={{ color: "var(--muted)", fontSize: 11, display: "block", marginTop: 4 }}>
                      ⓘ Fee collection will begin from the start date.
                    </small>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                      Group Deactivation Date
                    </label>
                    <input
                      type="date"
                      value={groupEndDate}
                      onChange={(e) => setGroupEndDate(e.target.value)}
                      placeholder="Select payment end day"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}
                    />
                    <small style={{ color: "var(--muted)", fontSize: 11, display: "block", marginTop: 4 }}>
                      ⓘ Group will be deactivated after this date.
                    </small>
                  </div>
                </div>

                {/* Amount */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                    Amount <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "#ffffff" }}>
                    <span style={{ padding: "10px 14px", background: "#f8fafc", borderRight: "1px solid var(--line)", fontWeight: 700, color: "var(--muted)" }}>
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={groupFeeAmount}
                      onChange={(e) => setGroupFeeAmount(Number(e.target.value))}
                      style={{ border: "none", outline: "none", padding: "10px 12px", width: "100%", fontSize: 14, fontWeight: 600 }}
                    />
                  </div>
                </div>

                {/* Working Days */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                    Working Days (Schedule)
                  </label>
                  <div className="working-days-row">
                    {WORKING_DAYS_OPTIONS.map((d) => {
                      const active = groupWorkingDays.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          className={`working-day-btn ${active ? "active" : ""}`}
                          onClick={() => handleDayToggle(d.key)}
                          title={d.full}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ADD MEMBERS (Screenshots 3 & 4) */}
          {wizardStep === 2 && (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 750, color: "var(--ink)", margin: 0 }}>
                Add Members
              </h3>

              {/* Selection Tabs */}
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    background: "#ecfdf5",
                    color: "#059669",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Add from members list
                </span>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    background: "#f8fafc",
                    color: "var(--muted)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Import file
                </span>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    background: "#f8fafc",
                    color: "var(--muted)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Add manually
                </span>
              </div>

              {/* Count & Search Row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  paddingTop: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <strong style={{ fontSize: 13 }}>Members {allPeople.length}</strong>
                  <div className="search-box" style={{ width: 280, height: 34 }}>
                    <Icon name="search" size={14} />
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                  </div>
                </div>

                <Badge tone="green">Selected {selectedMembers.size}</Badge>
              </div>

              {/* Members Table */}
              <div className="table-wrap" style={{ maxHeight: 380, overflowY: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={
                            filteredPeople.length > 0 &&
                            filteredPeople.every((p) => selectedMembers.has(p.id))
                          }
                          onChange={() => selectAllFilteredMembers(filteredPeople)}
                        />
                      </th>
                      <th>Name</th>
                      <th>Mobile No</th>
                      <th>Due Amount</th>
                      <th>When do you want to collect fees?</th>
                      <th>Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPeople.map((person) => {
                      const isSelected = selectedMembers.has(person.id);
                      const memberData = selectedMembers.get(person.id);
                      return (
                        <tr
                          key={person.id}
                          className={isSelected ? "selected-row" : ""}
                          style={{
                            background: isSelected ? "#f0fdf4" : undefined,
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleMemberSelection(person.id)}
                            />
                          </td>
                          <td>
                            <strong>{person.displayName}</strong>
                          </td>
                          <td>
                            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                              {person.primaryPhone || "—"}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, width: 100 }}>
                              <span style={{ color: "var(--muted)", fontSize: 12 }}>₹</span>
                              <input
                                type="number"
                                min={0}
                                disabled={!isSelected}
                                value={
                                  isSelected && memberData
                                    ? memberData.customFeeMinor / 100
                                    : groupFeeAmount
                                }
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setSelectedMembers((curr) => {
                                    const next = new Map(curr);
                                    if (next.has(person.id)) {
                                      next.set(person.id, {
                                        customFeeMinor: val * 100,
                                        startDate: next.get(person.id)!.startDate,
                                      });
                                    }
                                    return next;
                                  });
                                }}
                                style={{
                                  width: "100%",
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid var(--line)",
                                  fontSize: 12,
                                  background: isSelected ? "#ffffff" : "#f8fafc",
                                }}
                              />
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>
                              Monthly: {groupCollectionDay}
                            </span>
                          </td>
                          <td>
                            <input
                              type="date"
                              disabled={!isSelected}
                              value={
                                isSelected && memberData
                                  ? memberData.startDate
                                  : groupStartDate
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedMembers((curr) => {
                                  const next = new Map(curr);
                                  if (next.has(person.id)) {
                                    next.set(person.id, {
                                      customFeeMinor: next.get(person.id)!.customFeeMinor,
                                      startDate: val,
                                    });
                                  }
                                  return next;
                                });
                              }}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: "1px solid var(--line)",
                                fontSize: 11.5,
                                background: isSelected ? "#ffffff" : "#f8fafc",
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 3: GROUP DETAIL VIEW (Screenshot 5)
          ========================================================================= */}
      {viewMode === "detail" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Top Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
            <button
              className="btn-link"
              onClick={() => setViewMode("list")}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0 }}
            >
              Groups
            </button>
            <span>&gt;</span>
            <strong style={{ color: "var(--ink)" }}>{groupDetail?.name || "Loading Group..."}</strong>
          </div>

          {detailLoading || !groupDetail ? (
            <div className="empty-state">
              <div className="state-spinner" />
              <p>Loading group details…</p>
            </div>
          ) : (
            <>
              {/* Group Hero Header Card (Screenshot 5) */}
              <div className="group-detail-header-card">
                <div className="group-detail-top-row">
                  <div className="group-detail-title-wrap">
                    <div
                      className="group-monogram-thumb"
                      style={{
                        background: groupDetail.color || "#dbeafe",
                        color: "#1e40af",
                      }}
                    >
                      {groupDetail.code}
                    </div>

                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--ink)" }}>
                        {groupDetail.name}
                      </h2>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: groupDetail.isActive ? "#059669" : "#64748b", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={groupDetail.isActive}
                            onChange={() => handleToggleGroupStatus(groupDetail.id, groupDetail.isActive)}
                          />
                          <span>{groupDetail.isActive ? "Active group" : "Inactive group"}</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditModalOpen(true)}
                    >
                      <Icon name="edit" size={14} />
                      <span>Edit group</span>
                    </button>
                  </div>
                </div>

                {/* Summary Stats Bar */}
                <div className="group-summary-stats-bar">
                  <div className="group-summary-stat-item">
                    <label>Total members</label>
                    <strong>{groupDetail.totalMembers}</strong>
                  </div>

                  <div className="group-summary-stat-item">
                    <label>Total active members</label>
                    <strong>{groupDetail.totalActiveMembers}</strong>
                  </div>

                  <div className="group-summary-stat-item">
                    <label>Billing type</label>
                    <strong>{groupDetail.billingType || "Fixed"}</strong>
                  </div>

                  <div className="group-summary-stat-item">
                    <label>Fee amount</label>
                    <strong>{formatCurrency(groupDetail.feeAmountMinor)}</strong>
                  </div>

                  <div className="group-summary-stat-item">
                    <label>Recurs</label>
                    <strong>{groupDetail.feeFrequency}</strong>
                  </div>

                  <div className="group-summary-stat-item">
                    <label>Due Date</label>
                    <strong>{groupDetail.collectionDay || "First day of month"}</strong>
                  </div>

                  <div className="group-summary-stat-item">
                    <label>Start date</label>
                    <strong>{new Date(groupDetail.startDate).toLocaleDateString()}</strong>
                  </div>

                  <div className="group-summary-stat-item">
                    <label>End date</label>
                    <strong>
                      {groupDetail.endDate
                        ? new Date(groupDetail.endDate).toLocaleDateString()
                        : "--"}
                    </strong>
                  </div>

                  <div className="group-summary-stat-item">
                    <label>Working days</label>
                    <div className="group-working-days-display">
                      {WORKING_DAYS_OPTIONS.map((d) => {
                        const active = groupDetail.workingDays.split(",").includes(d.key);
                        return (
                          <span
                            key={d.key}
                            className={active ? "active-day" : "inactive-day"}
                          >
                            {d.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="group-summary-stat-item">
                    <label>Created on</label>
                    <strong>{new Date(groupDetail.createdAt).toLocaleDateString()}</strong>
                  </div>
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <Tabs
                items={[
                  { id: "dashboard", label: "Dashboard" },
                  { id: "members", label: `Members (${groupDetail.totalMembers})` },
                  { id: "quick-collect", label: "Quick Collect" },
                  { id: "transactions", label: "Transactions" },
                  { id: "attendance", label: "Attendance" },
                ]}
                active={activeGroupTab}
                onChange={setActiveGroupTab}
              />

              {/* TAB 1: DASHBOARD (Screenshot 5) */}
              {activeGroupTab === "dashboard" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Insights Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>💡</span>
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Insights</h3>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
                      <span>&lt; {insightMonth} &gt;</span>
                    </div>
                  </div>

                  {/* Insight Metric Cards */}
                  <div className="group-insights-grid">
                    <div className="group-insight-card">
                      <div className="group-insight-icon-box" style={{ background: "#ecfdf5", color: "#059669" }}>
                        <Icon name="rupee" size={22} />
                      </div>
                      <div>
                        <small style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>
                          Total amount collected
                        </small>
                        <strong style={{ fontSize: 18, color: "#059669" }}>
                          {formatCurrency(groupDetail.totalCollectedMinor)}
                        </strong>
                      </div>
                    </div>

                    <div className="group-insight-card">
                      <div className="group-insight-icon-box" style={{ background: "#fef2f2", color: "#b91c1c" }}>
                        <Icon name="tag" size={22} />
                      </div>
                      <div>
                        <small style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>
                          Total amount due
                        </small>
                        <strong style={{ fontSize: 18, color: "#b91c1c" }}>
                          {formatCurrency(groupDetail.totalDueMinor)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Payments Card */}
                  <div style={{ background: "#ffffff", border: "1px solid var(--line)", borderRadius: 14, padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="finance" size={16} />
                        <strong style={{ fontSize: 14 }}>Monthly Payments</strong>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <a
                          href={`${api}/people/export`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, fontWeight: 700, color: "#059669", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <span>Download Report</span>
                          <Icon name="download" size={13} />
                        </a>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                          &lt; 2026 &gt;
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"
                      ].map((m) => (
                        <div
                          key={m}
                          style={{
                            flex: 1,
                            minWidth: 64,
                            padding: "10px 8px",
                            background: "#f8fafc",
                            border: "1px solid var(--line)",
                            borderRadius: 8,
                            textAlign: "center",
                          }}
                        >
                          <small style={{ color: "var(--muted)", fontSize: 11 }}>{m}</small>
                          <div style={{ fontWeight: 800, fontSize: 13, marginTop: 4 }}>₹ 0</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MEMBERS */}
              {activeGroupTab === "members" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 750, margin: 0 }}>
                      Enrolled Members ({groupDetail.members.length})
                    </h3>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setSingleMemberCustomFee(groupDetail.feeAmountMinor / 100);
                        setAddMemberModalOpen(true);
                      }}
                      style={{ background: "#059669", borderColor: "#059669" }}
                    >
                      <Icon name="plus" size={14} />
                      <span>+ Add Member to Group</span>
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Member Name</th>
                          <th>Contact</th>
                          <th>Group Fee</th>
                          <th>Total Due</th>
                          <th>Status</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupDetail.members.map((member) => (
                          <tr key={member.id}>
                            <td>
                              <strong>{member.displayName}</strong>
                            </td>
                            <td>
                              <div>
                                {member.primaryPhone && <div>{member.primaryPhone}</div>}
                                {member.email && (
                                  <small style={{ color: "var(--muted)" }}>{member.email}</small>
                                )}
                              </div>
                            </td>
                            <td>{formatCurrency(member.customFeeMinor)}</td>
                            <td>
                              <strong style={{ color: member.dueAmountMinor > 0 ? "#b91c1c" : "#059669" }}>
                                {formatCurrency(member.dueAmountMinor)}
                              </strong>
                            </td>
                            <td>
                              <Badge tone={member.status === "ACTIVE" ? "green" : "neutral"}>
                                {member.status}
                              </Badge>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                className="btn-icon"
                                title="Remove from group"
                                onClick={() => handleRemoveMember(member.personId)}
                              >
                                <Icon name="trash" size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: QUICK COLLECT */}
              {activeGroupTab === "quick-collect" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 16 }}>
                    <strong style={{ color: "#166534", fontSize: 14 }}>
                      ⚡ 1-Click WhatsApp Payment Reminders & Fee Collection
                    </strong>
                    <p style={{ fontSize: 12.5, color: "#15803d", margin: "4px 0 0" }}>
                      Send customized payment link messages to all members with pending dues in {groupDetail.name}.
                    </p>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Mobile</th>
                          <th>Due Amount</th>
                          <th style={{ textAlign: "right" }}>Quick Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupDetail.members.map((m) => {
                          const whatsappMsg = `Hello ${m.displayName}, your fee of ${formatCurrency(m.dueAmountMinor)} for ${groupDetail.name} is due. Please pay at your earliest convenience. Thank you!`;
                          const whatsappUrl = m.primaryPhone
                            ? `https://wa.me/${m.primaryPhone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMsg)}`
                            : null;
                          return (
                            <tr key={m.id}>
                              <td><strong>{m.displayName}</strong></td>
                              <td>{m.primaryPhone || "—"}</td>
                              <td><strong style={{ color: "#b91c1c" }}>{formatCurrency(m.dueAmountMinor)}</strong></td>
                              <td style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                                  {whatsappUrl && (
                                    <a
                                      href={whatsappUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn btn-secondary btn-sm"
                                      style={{ color: "#166534", background: "#f0fdf4", borderColor: "#86efac" }}
                                    >
                                      📲 WhatsApp
                                    </a>
                                  )}
                                  <a
                                    href={`/finance?action=new-invoice&personId=${m.personId}&price=${m.dueAmountMinor / 100}&description=${encodeURIComponent(`Monthly Fee - ${groupDetail.name}`)}`}
                                    className="btn btn-primary btn-sm"
                                    style={{ background: "#059669", borderColor: "#059669" }}
                                  >
                                    Collect
                                  </a>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: TRANSACTIONS */}
              {activeGroupTab === "transactions" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 750, margin: 0 }}>Fee Invoices & Payments</h3>
                    <a
                      href={`/finance?action=new-invoice`}
                      className="btn btn-primary btn-sm"
                      style={{ background: "#059669", borderColor: "#059669" }}
                    >
                      <Icon name="plus" size={14} />
                      <span>New Invoice</span>
                    </a>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Invoice / Ref</th>
                          <th>Member</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupDetail.members.flatMap((m) =>
                          (m.recentInvoices || []).map((inv) => (
                            <tr key={inv.id}>
                              <td><strong>{inv.invoiceNumber}</strong></td>
                              <td>{m.displayName}</td>
                              <td>{formatCurrency(inv.totalMinor)}</td>
                              <td>
                                <Badge tone={inv.status === "PAID" ? "green" : "neutral"}>
                                  {inv.status}
                                </Badge>
                              </td>
                              <td>{new Date(inv.issueDate).toLocaleDateString()}</td>
                            </tr>
                          )),
                        )}
                        {groupDetail.members.every((m) => (m.recentInvoices || []).length === 0) && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                              No transactions recorded for this group yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: ATTENDANCE */}
              {activeGroupTab === "attendance" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 750, margin: 0 }}>Group Attendance Register</h3>
                      <small style={{ color: "var(--muted)" }}>
                        Working Days: {groupDetail.workingDays}
                      </small>
                    </div>
                    <a
                      href="/students"
                      className="btn btn-secondary btn-sm"
                    >
                      <span>Open Full Attendance Matrix →</span>
                    </a>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Phone</th>
                          <th>Today's Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupDetail.members.map((m) => (
                          <tr key={m.id}>
                            <td><strong>{m.displayName}</strong></td>
                            <td>{m.primaryPhone || "—"}</td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="btn btn-secondary btn-sm" style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #86efac", fontSize: 11, padding: "2px 8px" }}>
                                  Present
                                </button>
                                <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: "2px 8px" }}>
                                  Absent
                                </button>
                                <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: "2px 8px" }}>
                                  Leave
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Add Member to Group Modal */}
          <Modal
            isOpen={addMemberModalOpen}
            onClose={() => setAddMemberModalOpen(false)}
            title="Add Member to Group"
            subtitle={`Enroll a new member into ${groupDetail?.name}`}
            maxWidth={480}
          >
            <form onSubmit={handleAddSingleMember} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label>Select Member *</label>
                <select
                  value={singleMemberPersonId}
                  onChange={(e) => setSingleMemberPersonId(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff" }}
                  required
                >
                  <option value="">-- Choose Member --</option>
                  {allPeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} {p.primaryPhone ? `(${p.primaryPhone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Monthly Fee Amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={singleMemberCustomFee}
                  onChange={(e) => setSingleMemberCustomFee(Number(e.target.value))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
                />
              </div>

              <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAddMemberModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addMemberBusy || !singleMemberPersonId}
                  style={{ background: "#059669", borderColor: "#059669" }}
                >
                  {addMemberBusy ? "Enrolling…" : "Enroll Member"}
                </button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </AppShell>
  );
}

export default function GroupsPage() {
  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <div className="state-spinner" />
          <p>Loading groups…</p>
        </div>
      }
    >
      <GroupsContent />
    </Suspense>
  );
}
