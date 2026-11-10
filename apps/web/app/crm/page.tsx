"use client";

import {
  AppShell,
  Badge,
  Drawer,
  EmptyState,
  Icon,
  Modal,
  StatCard,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import {
  useWorkspace,
  isRealEstateWorkspace,
} from "@/lib/nav";
import { LeadCaptureModal } from "./LeadCaptureModal";

type Stage = {
  id: string;
  name: string;
  order: number;
};

type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
};

type FollowUp = {
  id: string;
  dueAt: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  outcome: string | null;
  completedAt: string | null;
  assignedTo?: { user: { name: string | null; email: string } };
};

type LeadNote = {
  id: string;
  body: string;
  createdAt: string;
  author?: { name: string | null; email: string };
};

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  expectedValueMinor: number | null;
  status: "OPEN" | "CONVERTED" | "LOST";
  lostReason: string | null;
  createdAt: string;
  stageId: string;
  stage?: Stage;
  pipelineId: string;
  personId: string | null;
  followUps?: FollowUp[];
  notes?: LeadNote[];
  activities?: Array<{
    id: string;
    action: string;
    summary: string;
    createdAt: string;
  }>;
};

type CrmMetrics = {
  openLeads: number;
  pipelineValueMinor: number;
  overdueFollowUps: number;
  convertedCount: number;
};

function formatMoney(amountMinor: number | null | undefined, currency = "INR") {
  if (!amountMinor) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function CrmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = getApiUrl();

  // Data states
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState<CrmMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Views & Filters
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CONVERTED" | "LOST" | "ALL">("OPEN");
  const [search, setSearch] = useState("");

  const { orgName, userName, userRole, organisations, navItems, updateWorkspace, businessType, activeServices } = useWorkspace();

  const isCoachingOrSchool = (() => {
    const bt = (businessType || "").toLowerCase();
    const on = (orgName || "").toLowerCase();
    return (
      bt.includes("coaching") ||
      bt.includes("tuition") ||
      bt.includes("academy") ||
      bt.includes("school") ||
      bt.includes("classes") ||
      on.includes("coaching") ||
      on.includes("classes") ||
      on.includes("tutorials") ||
      (Boolean(activeServices?.includes("students")) && !bt.includes("real estate") && !on.includes("saleswale") && !bt.includes("sales"))
    );
  })();

  const isRealEstate = isRealEstateWorkspace(businessType, orgName);

  // Modals & Drawers
  const [createOpen, setCreateOpen] = useState(false);
  const [leadCaptureOpen, setLeadCaptureOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [postConvertResult, setPostConvertResult] = useState<any | null>(null);
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostReason, setLostReason] = useState("Not interested / Budget constraint");
  const [importOpen, setImportOpen] = useState(false);
  const [todayFollowUps, setTodayFollowUps] = useState<any[]>([]);

  // Form states - Create Lead
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formSource, setFormSource] = useState("Website");
  const [formValue, setFormValue] = useState("");
  const [formStageId, setFormStageId] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Sub-actions in Detail Drawer
  const [newNote, setNewNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [followUpDue, setFollowUpDue] = useState("");
  const [followUpOutcome, setFollowUpOutcome] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);

  function applyLeadTemplate(name: string, value: string, source: string) {
    if (!formName.trim()) setFormName(name);
    setFormValue(value);
    setFormSource(source);
  }

  function setQuickFollowUpPreset(type: "TODAY_5PM" | "TOMORROW_11AM" | "IN_3_DAYS" | "NEXT_WEEK") {
    const now = new Date();
    const target = new Date();
    let note = "Follow-up Call";

    if (type === "TODAY_5PM") {
      target.setHours(17, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      note = isCoachingOrSchool ? "Call & Fee Discussion" : "Call & Deal Discussion";
    } else if (type === "TOMORROW_11AM") {
      target.setDate(target.getDate() + 1);
      target.setHours(11, 0, 0, 0);
      note = isCoachingOrSchool ? "WhatsApp & Course Details" : "WhatsApp & Property / Deal Brochure";
    } else if (type === "IN_3_DAYS") {
      target.setDate(target.getDate() + 3);
      target.setHours(12, 0, 0, 0);
      note = isCoachingOrSchool ? "Check Admission Decision" : "Site Visit / Proposal Follow-up";
    } else if (type === "NEXT_WEEK") {
      target.setDate(target.getDate() + 7);
      target.setHours(15, 0, 0, 0);
      note = isCoachingOrSchool ? "Demo Class Feedback & Closing" : "Final Negotiation & Deal Closing";
    }

    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, "0");
    const day = String(target.getDate()).padStart(2, "0");
    const hours = String(target.getHours()).padStart(2, "0");
    const mins = String(target.getMinutes()).padStart(2, "0");
    setFollowUpDue(`${year}-${month}-${day}T${hours}:${mins}`);
    setFollowUpOutcome(note);
  }

  // Lost Reason Modal/Input
  const [lostReasonInput, setLostReasonInput] = useState("");

  // CSV Import Form
  const [importCsvText, setImportCsvText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);

  // Load session context
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
          const srvs = activeOrgEntry.activeServices || activeOrgEntry.organisation.activeServices;
          updateWorkspace({
            orgName: activeOrgEntry.organisation.name,
            userRole: activeOrgEntry.role?.name || "Sales",
            ...(Array.isArray(srvs) && srvs.length > 0 ? { activeServices: srvs } : {}),
          });
        }
      }
    } catch {
      // ignore
    }
  }, [api, router, updateWorkspace]);

  // Load Pipelines
  const loadPipelines = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/crm/pipelines`, { credentials: "include" });
      if (res.ok) {
        const data: Pipeline[] = await res.json();
        setPipelines(data);
        if (data.length > 0) {
          const defaultPipe = data.find((p) => p.isDefault) || data[0];
          if (defaultPipe && !selectedPipelineId) {
            setSelectedPipelineId(defaultPipe.id);
            if (defaultPipe.stages && defaultPipe.stages.length > 0 && defaultPipe.stages[0]) {
              setFormStageId(defaultPipe.stages[0].id);
            }
          }
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [api, selectedPipelineId]);

  // Load Metrics
  const loadMetrics = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/crm/metrics`, { credentials: "include" });
      if (res.ok) {
        setMetrics(await res.json());
      }
    } catch {
      // ignore
    }
  }, [api]);

  // Load Leads list
  const loadLeads = useCallback(async () => {
    if (!selectedPipelineId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("pipelineId", selectedPipelineId);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await authFetch(`${api}/crm/leads?${params.toString()}`, { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load leads.");
      const data = await res.json();
      setLeads(data.items || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, selectedPipelineId, statusFilter, search, router]);

  const loadTodayFollowUps = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/crm/follow-ups/today`, { credentials: "include" });
      if (res.ok) {
        setTodayFollowUps(await res.json());
      }
    } catch {}
  }, [api]);

  useEffect(() => {
    loadContext();
    loadPipelines();
    loadMetrics();
    loadTodayFollowUps();
  }, [loadContext, loadPipelines, loadMetrics, loadTodayFollowUps]);

  useEffect(() => {
    if (selectedPipelineId) {
      loadLeads();
    }
  }, [selectedPipelineId, loadLeads]);

  // Handle URL deep link
  useEffect(() => {
    const action = searchParams.get("action");
    const leadId = searchParams.get("leadId");
    const personName = searchParams.get("name");
    if (action === "new") {
      if (personName) setFormName(personName);
      setCreateOpen(true);
    }
    if (leadId) {
      authFetch(`${api}/crm/leads/${leadId}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((l) => {
          if (l) setDetailLead(l);
        })
        .catch(() => {});
    }
  }, [searchParams, api]);

  const activePipeline = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];
  const stages = activePipeline?.stages?.slice().sort((a, b) => a.order - b.order) || [];

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormSource("Website");
    setFormValue("");
    if (stages.length > 0 && stages[0]) setFormStageId(stages[0].id);
    setFormError("");
  }

  async function handleCreateLead(e: FormEvent) {
    e.preventDefault();
    setFormBusy(true);
    setFormError("");
    try {
      const valNum = parseFloat(formValue);
      const res = await authFetch(`${api}/crm/leads`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          source: formSource || undefined,
          pipelineId: selectedPipelineId,
          stageId: formStageId || (stages[0]?.id ?? ""),
          expectedValueMinor: !isNaN(valNum) && valNum > 0 ? Math.round(valNum * 100) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = data.message || "Failed to create lead.";
        if (typeof msg === "string" && msg.toLowerCase().includes("internal server error")) {
          msg = "Unable to save lead on server. Please check your connection and try again.";
        }
        throw new Error(msg);
      }
      setCreateOpen(false);
      resetForm();
      loadLeads();
      loadMetrics();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormBusy(false);
    }
  }

  async function handleStageChange(leadId: string, newStageId: string) {
    try {
      const res = await authFetch(`${api}/crm/leads/${leadId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stageId: newStageId }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (detailLead?.id === leadId) setDetailLead(updated);
        loadLeads();
        loadMetrics();
      }
    } catch {
      // ignore
    }
  }

  async function handleStatusChange(leadId: string, newStatus: "OPEN" | "CONVERTED" | "LOST", reason?: string) {
    try {
      const res = await authFetch(`${api}/crm/leads/${leadId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus, lostReason: reason || undefined }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (detailLead?.id === leadId) setDetailLead(updated);
        loadLeads();
        loadMetrics();
      }
    } catch {
      // ignore
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!detailLead || !newNote.trim()) return;
    setNoteBusy(true);
    try {
      const res = await authFetch(`${api}/crm/leads/${detailLead.id}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: newNote.trim() }),
      });
      if (res.ok) {
        setNewNote("");
        // refresh lead
        const leadRes = await authFetch(`${api}/crm/leads/${detailLead.id}`, { credentials: "include" });
        if (leadRes.ok) setDetailLead(await leadRes.json());
      }
    } catch {
      // ignore
    } finally {
      setNoteBusy(false);
    }
  }

  async function handleScheduleFollowUp(e: FormEvent) {
    e.preventDefault();
    if (!detailLead || !followUpDue) return;
    setFollowUpBusy(true);
    try {
      const res = await authFetch(`${api}/crm/leads/${detailLead.id}/follow-ups`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dueAt: new Date(followUpDue).toISOString(),
          outcome: followUpOutcome || undefined,
        }),
      });
      if (res.ok) {
        setFollowUpDue("");
        setFollowUpOutcome("");
        const leadRes = await authFetch(`${api}/crm/leads/${detailLead.id}`, { credentials: "include" });
        if (leadRes.ok) setDetailLead(await leadRes.json());
        loadMetrics();
      }
    } catch {
      // ignore
    } finally {
      setFollowUpBusy(false);
    }
  }

  async function handleCompleteFollowUp(followUpId: string) {
    try {
      const res = await authFetch(`${api}/crm/follow-ups/${followUpId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (res.ok && detailLead) {
        const leadRes = await authFetch(`${api}/crm/leads/${detailLead.id}`, { credentials: "include" });
        if (leadRes.ok) setDetailLead(await leadRes.json());
        loadMetrics();
      }
    } catch {
      // ignore
    }
  }

  async function handleConvertLead() {
    if (!detailLead) return;
    try {
      const res = await authFetch(`${api}/crm/leads/${detailLead.id}/convert`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setConvertModalOpen(false);
        setPostConvertResult(data);
        const leadRes = await authFetch(`${api}/crm/leads/${detailLead.id}`, { credentials: "include" });
        if (leadRes.ok) setDetailLead(await leadRes.json());
        loadLeads();
        loadMetrics();
      }
    } catch {
      // ignore
    }
  }

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/crm"
      nav={navItems}
      userName={userName}
      userRole={userRole}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
      onPrefetch={(href) => router.prefetch(href)}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="crm" size={14} /> Pipeline & Deals
          </p>
          <h1>Leads & CRM Pipeline</h1>
          <p className="subheading">
            Track inquiries, manage follow-ups, and convert leads into long-term customers.
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setLeadCaptureOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#eef2ff",
              color: "#4338ca",
              borderColor: "#c7d2fe",
              fontWeight: 600,
            }}
          >
            <Icon name="zap" size={15} />
            <span>Lead Capture & Alerts</span>
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setImportOpen(true)}
          >
            <Icon name="upload" size={15} />
            <span>Import Leads</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Icon name="plus" size={15} />
            <span>Create Lead</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="stats-grid">
        <StatCard
          label="Open Leads"
          value={metrics?.openLeads ?? leads.filter((l) => l.status === "OPEN").length}
          change="Active in pipeline"
          icon="crm"
          tone="blue"
        />
        <StatCard
          label="Pipeline Value"
          value={formatMoney(metrics?.pipelineValueMinor)}
          change="Estimated potential"
          icon="finance"
          tone="amber"
        />
        <StatCard
          label="Overdue Follow-ups"
          value={metrics?.overdueFollowUps ?? 0}
          change={metrics?.overdueFollowUps ? "Action required" : "All up to date"}
          icon="clock"
          tone={metrics?.overdueFollowUps ? "rose" : "teal"}
        />
        <StatCard
          label="Converted Leads"
          value={metrics?.convertedCount ?? leads.filter((l) => l.status === "CONVERTED").length}
          change="Won deals"
          icon="checkCircle"
          tone="teal"
        />
      </div>

      {/* 📞 Today's Scheduled Follow-ups & Calls Widget */}
      {todayFollowUps.length > 0 && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #7fabfd",
            borderRadius: 14,
            padding: "18px 20px",
            marginBottom: 20,
            boxShadow: "0 4px 16px rgba(127, 171, 253, 0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#eef4ff",
                  color: "#3572e8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="phone" size={17} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>Today&apos;s Follow-up Calls &amp; Tasks</span>
                  <span
                    style={{
                      background: "#fee2e2",
                      color: "#dc2626",
                      fontSize: 11,
                      fontWeight: 750,
                      padding: "2px 8px",
                      borderRadius: 12,
                    }}
                  >
                    {todayFollowUps.length} Pending
                  </span>
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  Scheduled client calls, site visits, and demo reminders due today
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {todayFollowUps.map((fu) => {
              const dueTime = new Date(fu.dueAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
              const leadPhone = fu.lead?.phone;
              const leadName = fu.lead?.name || "Client";
              const cleanPhone = leadPhone ? leadPhone.replace(/\D/g, "") : "";
              const waText = encodeURIComponent(`Hello ${leadName}, this is regarding our scheduled follow-up from ${orgName}.`);

              return (
                <div
                  key={fu.id}
                  style={{
                    background: "#f8fbfe",
                    border: "1px solid #dbe5f2",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <strong
                        style={{ fontSize: 14, color: "var(--ink)", cursor: "pointer", textDecoration: "underline" }}
                        onClick={() => {
                          if (fu.lead?.id) {
                            authFetch(`${api}/crm/leads/${fu.lead.id}`, { credentials: "include" })
                              .then((r) => (r.ok ? r.json() : null))
                              .then((l) => { if (l) setDetailLead(l); });
                          }
                        }}
                      >
                        {leadName}
                      </strong>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#3572e8", background: "#eef4ff", padding: "1px 6px", borderRadius: 4 }}>
                          ⏰ {dueTime}
                        </span>
                        {fu.lead?.stage && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                            • {fu.lead.stage.name}
                          </span>
                        )}
                      </div>
                      {fu.outcome && (
                        <p style={{ margin: "5px 0 0", fontSize: 12, color: "#334155", fontStyle: "italic" }}>
                          &ldquo;{fu.outcome}&rdquo;
                        </p>
                      )}
                    </div>

                    {fu.lead?.expectedValueMinor ? (
                      <span style={{ fontSize: 12, fontWeight: 750, color: "#059669" }}>
                        {formatMoney(fu.lead.expectedValueMinor)}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 6, borderTop: "1px dashed #dbe5f2" }}>
                    {leadPhone && (
                      <>
                        <a
                          href={`https://wa.me/${cleanPhone}?text=${waText}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            flex: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            background: "#25D366",
                            color: "#ffffff",
                            padding: "6px 10px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          <span>WhatsApp</span>
                        </a>

                        <a
                          href={`tel:${leadPhone}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            color: "#0f172a",
                            padding: "6px 10px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          <span>Call</span>
                        </a>
                      </>
                    )}

                    <button
                      onClick={async () => {
                        await handleCompleteFollowUp(fu.id);
                        loadTodayFollowUps();
                      }}
                      className="primary-button"
                      style={{ padding: "6px 10px", fontSize: 11.5, background: "#059669", borderColor: "#059669" }}
                    >
                      <Icon name="check" size={12} />
                      <span>Done</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="toolbar">
        <div className="toolbar-actions">
          {pipelines.length > 1 && (
            <select
              className="filter-select"
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "OPEN" | "CONVERTED" | "LOST" | "ALL")}
          >
            <option value="OPEN">Open Deals</option>
            <option value="CONVERTED">Converted</option>
            <option value="LOST">Lost</option>
            <option value="ALL">All Statuses</option>
          </select>

          <div className="search-box" style={{ minWidth: 200 }}>
            <Icon name="search" size={15} />
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="toolbar-actions">
          <button
            className={`btn btn-sm ${viewMode === "kanban" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setViewMode("kanban")}
          >
            <Icon name="kanban" size={15} />
            <span>Kanban</span>
          </button>
          <button
            className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setViewMode("table")}
          >
            <Icon name="list" size={15} />
            <span>Table</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="state-spinner" />
          <p>Loading sales pipeline…</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <Icon name="alertCircle" size={28} />
          <h3>Error Loading CRM</h3>
          <p>{error}</p>
        </div>
      ) : leads.length === 0 && !search ? (
        <EmptyState
          icon="crm"
          title="No leads in this pipeline yet"
          description="Create your first lead to start tracking potential deals through your sales stages."
          actionLabel="Create Lead"
          onAction={() => {
            resetForm();
            setCreateOpen(true);
          }}
        />
      ) : viewMode === "kanban" ? (
        /* Kanban Pipeline Board */
        <div className="kanban-board">
          {stages.map((stage) => {
            const stageLeads = leads.filter((l) => l.stageId === stage.id);
            const stageTotalMinor = stageLeads.reduce(
              (acc, l) => acc + (l.expectedValueMinor || 0),
              0,
            );

            return (
              <div key={stage.id} className="kanban-column">
                <div className="kanban-column-header">
                  <strong>
                    <span>{stage.name}</span>
                    <Badge tone="neutral">{stageLeads.length}</Badge>
                  </strong>
                  <small style={{ color: "var(--muted)", fontWeight: 600 }}>
                    {formatMoney(stageTotalMinor)}
                  </small>
                </div>

                <div className="kanban-cards-list">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="kanban-card"
                      onClick={() => setDetailLead(lead)}
                    >
                      <div className="kanban-card-title">{lead.name}</div>
                      {lead.expectedValueMinor && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>
                          {formatMoney(lead.expectedValueMinor)}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                        {lead.phone || lead.email || "No contact"}
                      </div>
                      <div className="kanban-card-meta">
                        <Badge
                          tone={
                            lead.status === "CONVERTED"
                              ? "green"
                              : lead.status === "LOST"
                                ? "red"
                                : "blue"
                          }
                        >
                          {lead.status}
                        </Badge>
                        <span>{lead.source || "Website"}</span>
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div
                      style={{
                        padding: "20px 10px",
                        textAlign: "center",
                        fontSize: 12,
                        color: "var(--muted)",
                        border: "1px dashed #cbd5e1",
                        borderRadius: 8,
                      }}
                    >
                      Empty stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table List View */
        <>
          <div className="desktop-table-view">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lead Name</th>
                    <th>Contact</th>
                    <th>Stage</th>
                    <th>Expected Value</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const stageName = stages.find((s) => s.id === lead.stageId)?.name || "Initial";
                    return (
                      <tr
                        key={lead.id}
                        className="clickable"
                        onClick={() => setDetailLead(lead)}
                      >
                        <td>
                          <strong>{lead.name}</strong>
                        </td>
                        <td>
                          <div>
                            {lead.email && <div>{lead.email}</div>}
                            {lead.phone && <small style={{ color: "var(--muted)" }}>{lead.phone}</small>}
                          </div>
                        </td>
                        <td>
                          <Badge tone="neutral">{stageName}</Badge>
                        </td>
                        <td>
                          <strong>{formatMoney(lead.expectedValueMinor)}</strong>
                        </td>
                        <td>{lead.source || "—"}</td>
                        <td>
                          <Badge
                            tone={
                              lead.status === "CONVERTED"
                                ? "green"
                                : lead.status === "LOST"
                                  ? "red"
                                  : "blue"
                            }
                          >
                            {lead.status}
                          </Badge>
                        </td>
                        <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDetailLead(lead)}
                          >
                            <Icon name="eye" size={14} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile View: Lead Cards */}
          <div className="mobile-cards-view">
            {leads.map((lead) => {
              const stageName = stages.find((s) => s.id === lead.stageId)?.name || "Initial";
              return (
                <div
                  key={lead.id}
                  className="mobile-record-card"
                  onClick={() => setDetailLead(lead)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="mobile-card-header">
                    <div>
                      <div className="mobile-card-name">{lead.name}</div>
                      <div className="mobile-card-subtext">
                        Stage: {stageName} {lead.source ? `· Source: ${lead.source}` : ""}
                      </div>
                    </div>
                    <Badge
                      tone={
                        lead.status === "CONVERTED"
                          ? "green"
                          : lead.status === "LOST"
                            ? "red"
                            : "blue"
                      }
                    >
                      {lead.status}
                    </Badge>
                  </div>

                  <div className="mobile-card-meta-row" style={{ marginTop: 8 }}>
                    <div>
                      <div className="mobile-card-label">Expected Value</div>
                      <div className="mobile-card-value" style={{ fontWeight: 700, color: "var(--brand-primary)" }}>
                        {formatMoney(lead.expectedValueMinor)}
                      </div>
                    </div>
                    {lead.phone && (
                      <div style={{ textAlign: "right" }}>
                        <div className="mobile-card-label">Contact</div>
                        <a
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 12.5, fontWeight: 650, color: "var(--brand-primary)" }}
                        >
                          {lead.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mobile-card-footer" style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setDetailLead(lead)}
                      style={{ padding: "6px 14px", borderRadius: 7 }}
                    >
                      <Icon name="eye" size={13} />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Lead Detail Drawer */}
      <Drawer
        isOpen={Boolean(detailLead)}
        onClose={() => setDetailLead(null)}
        title={detailLead?.name || "Lead Details"}
        subtitle="Sales Pipeline Opportunity"
        width={480}
      >
        {detailLead && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Value & Stage Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "#eff6ff",
                borderRadius: 10,
              }}
            >
              <div>
                <small style={{ color: "var(--muted)", fontSize: 11 }}>Expected Deal Value</small>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--brand)" }}>
                  {formatMoney(detailLead.expectedValueMinor)}
                </div>
              </div>
              <div>
                <Badge
                  tone={
                    detailLead.status === "CONVERTED"
                      ? "green"
                      : detailLead.status === "LOST"
                        ? "red"
                        : "blue"
                  }
                >
                  {detailLead.status}
                </Badge>
              </div>
            </div>

            {/* Stage Selector */}
            <div className="form-group">
              <label>Current Stage</label>
              <select
                className="filter-select"
                value={detailLead.stageId}
                onChange={(e) => handleStageChange(detailLead.id, e.target.value)}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Contact Details */}
            <div className="key-value-list">
              <div className="key-value-item">
                <label>Email</label>
                <span>{detailLead.email || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Phone</label>
                <span>{detailLead.phone || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Source</label>
                <span>{detailLead.source || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Created On</label>
                <span>{new Date(detailLead.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Status Actions */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                Deal Progression
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {detailLead.status === "OPEN" && (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleConvertLead()}
                    >
                      <Icon name="checkCircle" size={14} />
                      <span>Convert to Customer</span>
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setLostModalOpen(true)}
                    >
                      <Icon name="close" size={14} />
                      <span>Mark Lost</span>
                    </button>
                  </>
                )}
                {detailLead.status !== "OPEN" && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleStatusChange(detailLead.id, "OPEN")}
                  >
                    <Icon name="refresh" size={14} />
                    <span>Reopen Deal</span>
                  </button>
                )}
              </div>
            </div>
            {/* Follow-ups Section */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Follow-ups & Next Action</label>
              </div>

              {/* 1-Click Quick Follow-up Presets */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setQuickFollowUpPreset("TODAY_5PM")}
                  style={{ padding: "4px 8px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >
                  Call Today 5 PM
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFollowUpPreset("TOMORROW_11AM")}
                  style={{ padding: "4px 8px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >
                  WhatsApp Tomorrow 11 AM
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFollowUpPreset("IN_3_DAYS")}
                  style={{ padding: "4px 8px", background: "#fefce8", border: "1px solid #fef08a", color: "#a16207", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >
                  In 3 Days
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFollowUpPreset("NEXT_WEEK")}
                  style={{ padding: "4px 8px", background: "#faf5ff", border: "1px solid #e9d5ff", color: "#7e22ce", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >
                  Next Week Demo
                </button>
              </div>

              {/* Schedule Form */}
              <form onSubmit={handleScheduleFollowUp} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  type="datetime-local"
                  value={followUpDue}
                  onChange={(e) => setFollowUpDue(e.target.value)}
                  style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 7, fontSize: 12 }}
                  required
                />
                <input
                  type="text"
                  placeholder="Task note (e.g. Call client)"
                  value={followUpOutcome}
                  onChange={(e) => setFollowUpOutcome(e.target.value)}
                  style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 7, fontSize: 12 }}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={followUpBusy}>
                  Schedule
                </button>
              </form>

              {/* Follow-ups List */}
              <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
                {detailLead.followUps && detailLead.followUps.length > 0 ? (
                  detailLead.followUps.map((fu) => (
                    <li
                      key={fu.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        background: fu.status === "COMPLETED" ? "#f8fafc" : "#fef3c7",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <strong>{fu.outcome || "Follow-up Call"}</strong>
                        <div style={{ color: "var(--muted)", fontSize: 11 }}>
                          Due: {new Date(fu.dueAt).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        {fu.status === "SCHEDULED" ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCompleteFollowUp(fu.id)}
                          >
                            <Icon name="check" size={13} />
                            <span>Done</span>
                          </button>
                        ) : (
                          <Badge tone="green">Done</Badge>
                        )}
                      </div>
                    </li>
                  ))
                ) : (
                  <small style={{ color: "var(--muted)" }}>No follow-ups scheduled.</small>
                )}
              </ul>
            </div>

            {/* Notes Section */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Notes & Conversation</label>
              <form onSubmit={handleAddNote} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="Add a note or call update…"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 7, fontSize: 12 }}
                  required
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={noteBusy}>
                  Post Note
                </button>
              </form>
              <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
                {detailLead.notes && detailLead.notes.length > 0 ? (
                  detailLead.notes.map((n) => (
                    <li
                      key={n.id}
                      style={{
                        padding: "8px 10px",
                        background: "var(--panel-soft)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <p style={{ margin: 0 }}>{n.body}</p>
                      <small style={{ color: "var(--muted)", fontSize: 10 }}>
                        {new Date(n.createdAt).toLocaleString()} · {n.author?.name || "Team Member"}
                      </small>
                    </li>
                  ))
                ) : (
                  <small style={{ color: "var(--muted)" }}>No notes logged.</small>
                )}
              </ul>
            </div>
          </div>
        )}
      </Drawer>

      {/* Create Lead Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Lead / Inquiry"
        subtitle="Add prospective client or deal to your sales pipeline"
        maxWidth={540}
      >
        <form onSubmit={handleCreateLead} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {formError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {formError}
            </div>
          )}

          {/* Quick Lead Presets / 1-Click Templates */}
          <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                ⚡ Quick Presets
              </span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Auto-fill common deal types</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isRealEstate ? (
                <>
                  <button
                    type="button"
                    onClick={() => applyLeadTemplate("2 BHK / 3 BHK Apartment Buyer", "7500000", "Website")}
                    style={{ padding: "6px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    🏡 Buyer Inquiry (₹75L)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyLeadTemplate("Commercial Office / Retail Space", "15000000", "Phone Call")}
                    style={{ padding: "6px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    🏢 Commercial Deal (₹1.5Cr)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyLeadTemplate("Plot / Land Investment", "5000000", "Referral")}
                    style={{ padding: "6px 12px", background: "#faf5ff", border: "1px solid #e9d5ff", color: "#7e22ce", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    📍 Plot / Land (₹50L)
                  </button>
                </>
              ) : isCoachingOrSchool ? (
                <>
                  <button
                    type="button"
                    onClick={() => applyLeadTemplate("Full Course Admission Lead", "25000", "Walk-in")}
                    style={{ padding: "6px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    🎓 Full Course (₹25k)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyLeadTemplate("Crash Course Inquiry", "8000", "Social Media")}
                    style={{ padding: "6px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    📖 Crash Course (₹8k)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyLeadTemplate("Consulting Retainer Lead", "50000", "Referral")}
                    style={{ padding: "6px 12px", background: "#faf5ff", border: "1px solid #e9d5ff", color: "#7e22ce", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    💼 Consulting (₹50k)
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => applyLeadTemplate("Standard Business Inquiry", "15000", "Website")}
                    style={{ padding: "6px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    💬 General Inquiry (₹15k)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyLeadTemplate("Hot Deal / High Intent", "50000", "Phone Call")}
                    style={{ padding: "6px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    🔥 Hot Deal (₹50k)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyLeadTemplate("Enterprise Retainer / Contract", "150000", "Referral")}
                    style={{ padding: "6px 12px", background: "#faf5ff", border: "1px solid #e9d5ff", color: "#7e22ce", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    💼 Enterprise (₹1.5L)
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group full">
              <label>Lead / Client Name *</label>
              <input
                type="text"
                placeholder={isRealEstate ? "e.g. Ramesh Sharma (3BHK Buyer)" : isCoachingOrSchool ? "e.g. Vikram Verma (Class 10)" : "e.g. Vikram Verma or Apex Corp"}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="client@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div className="form-group full">
              <label>Estimated Value (₹)</label>
              <input
                type="number"
                placeholder={isRealEstate ? "e.g. 7500000" : "e.g. 25000"}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
              {/* Quick Amount Chips */}
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {(isRealEstate ? [500000, 2500000, 5000000, 7500000, 15000000] : [5000, 10000, 25000, 50000, 100000]).map((amt) => {
                  const isSelected = formValue === String(amt);
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFormValue(String(amt))}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: isSelected ? "1px solid #3b82f6" : "1px solid #cbd5e1",
                        background: isSelected ? "#eff6ff" : "#ffffff",
                        color: isSelected ? "#1d4ed8" : "#475569",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isRealEstate && amt >= 10000000
                        ? `₹${amt / 10000000}Cr`
                        : isRealEstate && amt >= 100000
                        ? `₹${amt / 100000}L`
                        : `₹${amt.toLocaleString("en-IN")}`}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="form-group full">
              <label>Lead Source</label>
              <select
                value={formSource}
                onChange={(e) => setFormSource(e.target.value)}
              >
                <option value="WhatsApp">📱 WhatsApp</option>
                <option value="Walk-in">🚶 Walk-in / In-Person Visit</option>
                <option value="Phone Call">📞 Phone Call</option>
                <option value="Social Media">📸 Social Media / Instagram Ads</option>
                <option value="Website">🌐 Website Inquiry</option>
                <option value="Google Search">🔍 Google Search</option>
                <option value="Referral">🤝 Client Referral</option>
                <option value="Other">Other</option>
              </select>
              {/* Quick Source Chips */}
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {["WhatsApp", "Walk-in", "Phone Call", "Social Media", "Website", "Referral"].map((src) => {
                  const isSelected = formSource === src;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setFormSource(src)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: isSelected ? "1px solid #3b82f6" : "1px solid #cbd5e1",
                        background: isSelected ? "#eff6ff" : "#ffffff",
                        color: isSelected ? "#1d4ed8" : "#475569",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {src}
                    </button>
                  );
                })}
              </div>
            </div>
            {stages.length > 0 && (
              <div className="form-group full">
                <label>Initial Pipeline Stage</label>
                <select
                  value={formStageId}
                  onChange={(e) => setFormStageId(e.target.value)}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="modal-sticky-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formBusy}>
              {formBusy ? "Creating…" : "Save Lead"}
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportResult(null);
        }}
        title="Import Leads from CSV"
        subtitle="Bulk ingest leads into sales pipeline"
        maxWidth={560}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!importCsvText.trim()) return;
            setImportBusy(true);
            try {
              const res = await authFetch(`${api}/crm/leads/import`, {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  csv: importCsvText,
                  pipelineId: selectedPipelineId,
                  stageId: stages[0]?.id,
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || "Import failed.");
              setImportResult(data);
              loadLeads();
              loadMetrics();
            } catch (err) {
              alert((err as Error).message);
            } finally {
              setImportBusy(false);
            }
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            Paste CSV data with headers: <code>name, email, phone, source, value</code>
          </p>
          <textarea
            rows={7}
            placeholder={`name,email,phone,source,value\nVikram Malhotra,vikram@example.com,+919876543210,Website,45000\nSanjay Gupta,sanjay@example.com,+919876543211,Referral,75000`}
            value={importCsvText}
            onChange={(e) => setImportCsvText(e.target.value)}
            style={{
              width: "100%",
              fontFamily: "monospace",
              fontSize: 12,
              padding: 10,
              border: "1px solid var(--line)",
              borderRadius: 8,
            }}
            required
          />

          {importResult && (
            <div style={{ padding: 10, borderRadius: 8, fontSize: 12, background: "#dcfce7", color: "#15803d" }}>
              <strong>Successfully imported {importResult.imported} leads!</strong>
            </div>
          )}

          <div className="modal-sticky-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setImportOpen(false);
                setImportResult(null);
              }}
            >
              Close
            </button>
            <button type="submit" className="btn btn-primary" disabled={importBusy}>
              {importBusy ? "Importing…" : "Start Import"}
            </button>
          </div>
        </form>
      </Modal>

      <LeadCaptureModal
        isOpen={leadCaptureOpen}
        onClose={() => setLeadCaptureOpen(false)}
        orgName={orgName}
      />

      {/* Connected Flow: Post Lead Conversion Bridge */}
      {postConvertResult && (
        <Modal
          title="🎉 Lead Successfully Converted!"
          isOpen={Boolean(postConvertResult)}
          onClose={() => setPostConvertResult(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
              <strong>{postConvertResult.person?.displayName}</strong> is now converted into a registered customer. Choose your next action:
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ justifyContent: "flex-start", padding: "14px 16px", height: "auto" }}
                onClick={() => {
                  const p = postConvertResult.person;
                  if (isCoachingOrSchool) {
                    router.push(`/students?admit=true&personId=${p?.id || ""}&name=${encodeURIComponent(p?.displayName || "")}&phone=${encodeURIComponent(p?.primaryPhone || "")}&email=${encodeURIComponent(p?.email || "")}`);
                  } else {
                    router.push(`/finance?personId=${p?.id || ""}&name=${encodeURIComponent(p?.displayName || "")}`);
                  }
                  setPostConvertResult(null);
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 750, fontSize: 14 }}>
                    {isCoachingOrSchool ? "🏫 Admit as Student & Setup Fee Cycle" : "💼 Onboard as Client & Create Deal / Invoice"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    {isCoachingOrSchool
                      ? "Open admission form pre-filled with student and parent details"
                      : "Create invoice or record client ledger pre-filled with deal details"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "14px 16px", height: "auto" }}
                onClick={() => {
                  router.push(`/quick-collect?personId=${postConvertResult.person?.id || ""}`);
                  setPostConvertResult(null);
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 750, fontSize: 14 }}>
                    {isCoachingOrSchool
                      ? "💬 Send WhatsApp Payment Link / Fee Receipt"
                      : "💬 Send WhatsApp Payment Link / Booking Advance"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Generate instant UPI link or log payment collection
                  </div>
                </div>
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPostConvertResult(null)}
              >
                Done (Stay in CRM)
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Styled Modal for Lost Reason */}
      {lostModalOpen && detailLead && (
        <Modal
          title="Mark Deal as Lost"
          isOpen={lostModalOpen}
          onClose={() => setLostModalOpen(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
              Specify why <strong>{detailLead.name}</strong> was marked as lost:
            </p>

            <select
              className="filter-select"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              style={{ width: "100%", height: 40 }}
            >
              <option value="Budget / Price too high">💰 Budget / Price too high</option>
              <option value="Chose another competitor">
                {isCoachingOrSchool ? "🏢 Chose another institute / competitor" : "🏢 Chose another competitor / agency"}
              </option>
              {isCoachingOrSchool ? (
                <option value="Batch timing mismatch">⏰ Batch timing not suitable</option>
              ) : (
                <option value="Requirement / Plan deferred">⏰ Requirement deferred / on hold</option>
              )}
              <option value="Did not respond to calls">📵 Did not respond to follow-up calls</option>
              <option value="Location too far">📍 Location / Property mismatch</option>
              <option value="Not interested">❌ Not interested</option>
            </select>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLostModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  handleStatusChange(detailLead.id, "LOST", lostReason);
                  setLostModalOpen(false);
                }}
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

export default function CrmPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="empty-state"
        style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
        suppressHydrationWarning
      >
        <div className="state-spinner" />
        <p>Loading sales pipeline…</p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div
          className="empty-state"
          style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
          suppressHydrationWarning
        >
          <div className="state-spinner" />
          <p>Loading sales pipeline…</p>
        </div>
      }
    >
      <div suppressHydrationWarning>
        <CrmContent />
      </div>
    </Suspense>
  );
}

