"use client";

import {
  AppShell,
  Badge,
  Drawer,
  EmptyState,
  Icon,
  Modal,
  Tabs,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const nav: NavItem[] = [
  { label: "Dashboard", icon: "home", href: "/" },
  { label: "People", icon: "people", href: "/people" },
  { label: "Leads & CRM", icon: "crm", href: "/crm" },
  { label: "Finance", icon: "finance", href: "/finance" },
  { label: "Payroll", icon: "payroll", href: "/payroll" },
  { label: "Inventory", icon: "inventory", href: "/inventory" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

type PersonType = "CUSTOMER" | "STUDENT" | "MEMBER" | "EMPLOYEE";

type Tag = {
  id: string;
  name: string;
  color?: string;
};

type Person = {
  id: string;
  displayName: string;
  primaryPhone: string | null;
  alternatePhone: string | null;
  email: string | null;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  notes: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  types: Array<{ type: PersonType }>;
  tags: Array<{ tagId: string; tag: Tag }>;
  activities?: Array<{
    id: string;
    action: string;
    summary: string;
    createdAt: string;
    actor?: { name: string | null; email: string };
  }>;
};

function PeopleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" && window.location.hostname.endsWith("crmkaro.com")
      ? "https://api.crmkaro.com/api/v1"
      : "http://localhost:4000/api/v1");

  // Data states
  const [people, setPeople] = useState<Person[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter states
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  // Context & AppShell info
  const [orgName, setOrgName] = useState("CRMKaro Workspace");
  const [userName, setUserName] = useState("Workspace User");
  const [userRole, setUserRole] = useState("Admin");
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);

  // Modals & Drawers
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailPerson, setDetailPerson] = useState<Person | null>(null);
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAltPhone, setFormAltPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formTypes, setFormTypes] = useState<PersonType[]>(["CUSTOMER"]);
  const [formSelectedTags, setFormSelectedTags] = useState<string[]>([]);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [duplicateWarnings, setDuplicateWarnings] = useState<
    Array<{ id: string; displayName: string; email: string | null; primaryPhone: string | null }>
  >([]);

  // Tag Form
  const [newTagName, setNewTagName] = useState("");
  const [tagBusy, setTagBusy] = useState(false);

  // CSV Import Form
  const [importCsvText, setImportCsvText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors?: string[] } | null>(null);

  // Load user session & current active org info
  const loadContext = useCallback(async () => {
    try {
      const meRes = await fetch(`${api}/auth/me`, { credentials: "include" });
      if (meRes.status === 401) {
        router.replace("/login");
        return;
      }
      const orgsRes = await fetch(`${api}/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgList = await orgsRes.json();
        const activeOrgEntry = orgList.find(
          (o: { organisation: { id: string; name: string } | null; role: { name: string } }) =>
            o.organisation,
        );
        if (activeOrgEntry?.organisation) {
          setOrgName(activeOrgEntry.organisation.name);
          setUserRole(activeOrgEntry.role?.name || "Member");
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

  // Load people list
  const loadPeople = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab === "ARCHIVED") {
        params.set("status", "ARCHIVED");
      } else if (activeTab !== "ALL") {
        params.set("type", activeTab);
      }
      if (selectedTag) params.set("tagId", selectedTag);

      const res = await fetch(`${api}/people?${params.toString()}`, { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load people records.");
      const data = await res.json();
      setPeople(data.items || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, search, activeTab, selectedTag, router]);

  // Load tags
  const loadTags = useCallback(async () => {
    try {
      const res = await fetch(`${api}/people/tags`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTags(data || []);
      }
    } catch {
      // ignore
    }
  }, [api]);

  useEffect(() => {
    loadContext();
    loadTags();
  }, [loadContext, loadTags]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  // Check URL query param for open actions or deep link
  useEffect(() => {
    const action = searchParams.get("action");
    const personId = searchParams.get("id");
    if (action === "new") setCreateOpen(true);
    if (personId) {
      fetch(`${api}/people/${personId}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((p) => {
          if (p) setDetailPerson(p);
        })
        .catch(() => {});
    }
  }, [searchParams, api]);

  // Check duplicates on email/phone change during create
  useEffect(() => {
    if (!createOpen || (!formEmail && !formPhone)) {
      setDuplicateWarnings([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${api}/people/duplicates`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: formEmail || undefined, phone: formPhone || undefined }),
        });
        if (res.ok) {
          const dups = await res.json();
          setDuplicateWarnings(dups || []);
        }
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formEmail, formPhone, createOpen, api]);

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormAltPhone("");
    setFormNotes("");
    setFormCity("");
    setFormState("");
    setFormStreet("");
    setFormPostalCode("");
    setFormTypes(["CUSTOMER"]);
    setFormSelectedTags([]);
    setFormError("");
    setDuplicateWarnings([]);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormBusy(true);
    setFormError("");
    try {
      const res = await fetch(`${api}/people`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: formName,
          email: formEmail || undefined,
          primaryPhone: formPhone || undefined,
          alternatePhone: formAltPhone || undefined,
          notes: formNotes || undefined,
          address: formCity || formState || formStreet
            ? { street: formStreet, city: formCity, state: formState, postalCode: formPostalCode }
            : undefined,
          types: formTypes,
          tagIds: formSelectedTags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create person.");
      setCreateOpen(false);
      resetForm();
      loadPeople();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormBusy(false);
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!detailPerson) return;
    setFormBusy(true);
    setFormError("");
    try {
      const res = await fetch(`${api}/people/${detailPerson.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: formName,
          email: formEmail || undefined,
          primaryPhone: formPhone || undefined,
          alternatePhone: formAltPhone || undefined,
          notes: formNotes || undefined,
          address: formCity || formState || formStreet
            ? { street: formStreet, city: formCity, state: formState, postalCode: formPostalCode }
            : undefined,
          types: formTypes,
          tagIds: formSelectedTags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update person.");
      setEditOpen(false);
      setDetailPerson(data);
      loadPeople();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormBusy(false);
    }
  }

  async function handleArchive(personId: string) {
    if (!confirm("Are you sure you want to archive this person?")) return;
    try {
      const res = await fetch(`${api}/people/${personId}/archive`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        if (detailPerson?.id === personId) setDetailPerson(null);
        loadPeople();
      }
    } catch {
      // ignore
    }
  }

  async function handleCreateTag(e: FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setTagBusy(true);
    try {
      const res = await fetch(`${api}/people/tags`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim() }),
      });
      if (res.ok) {
        setNewTagName("");
        loadTags();
      }
    } catch {
      // ignore
    } finally {
      setTagBusy(false);
    }
  }

  async function handleImportCsv(e: FormEvent) {
    e.preventDefault();
    if (!importCsvText.trim()) return;
    setImportBusy(true);
    try {
      const res = await fetch(`${api}/people/import`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv: importCsvText, preview: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Import failed.");
      setImportResult(data);
      loadPeople();
    } catch (err) {
      setImportResult({ imported: 0, errors: [(err as Error).message] });
    } finally {
      setImportBusy(false);
    }
  }

  function openEditModal(person: Person) {
    setFormName(person.displayName);
    setFormEmail(person.email || "");
    setFormPhone(person.primaryPhone || "");
    setFormAltPhone(person.alternatePhone || "");
    setFormNotes(person.notes || "");
    setFormStreet(person.address?.street || "");
    setFormCity(person.address?.city || "");
    setFormState(person.address?.state || "");
    setFormPostalCode(person.address?.postalCode || "");
    setFormTypes(person.types.map((t) => t.type));
    setFormSelectedTags(person.tags.map((t) => t.tagId));
    setEditOpen(true);
  }

  const tabItems = [
    { id: "ALL", label: "All People" },
    { id: "CUSTOMER", label: "Customers" },
    { id: "STUDENT", label: "Students" },
    { id: "MEMBER", label: "Members" },
    { id: "EMPLOYEE", label: "Employees" },
    { id: "ARCHIVED", label: "Archived" },
  ];

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/people"
      nav={nav}
      userName={userName}
      userRole={userRole}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="people" size={14} /> Shared Directory
          </p>
          <h1>People & Directory</h1>
          <p className="subheading">
            Centralized directory for customers, students, members, and employees.
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setTagsModalOpen(true)}
          >
            <Icon name="tag" size={15} />
            <span>Manage Tags</span>
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setImportOpen(true)}
          >
            <Icon name="upload" size={15} />
            <span>Import CSV</span>
          </button>
          <a
            className="btn btn-secondary btn-sm"
            href={`${api}/people/export`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="download" size={15} />
            <span>Export CSV</span>
          </a>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Icon name="plus" size={15} />
            <span>Add Person</span>
          </button>
        </div>
      </div>

      <Tabs items={tabItems} active={activeTab} onChange={setActiveTab} />

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn-icon" onClick={() => setSearch("")}>
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        <div className="toolbar-actions">
          {tags.length > 0 && (
            <select
              className="filter-select"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="">All Tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="state-spinner" />
          <p>Loading directory records…</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <Icon name="alertCircle" size={28} />
          <h3>Error Loading People</h3>
          <p>{error}</p>
        </div>
      ) : people.length === 0 ? (
        <EmptyState
          icon="people"
          title="No people records found"
          description={
            search || selectedTag || activeTab !== "ALL"
              ? "Try adjusting your search or active filters."
              : "Start by adding your first customer, student, or member to your directory."
          }
          actionLabel="Add Person"
          onAction={() => {
            resetForm();
            setCreateOpen(true);
          }}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Person Name</th>
                <th>Contact</th>
                <th>Types</th>
                <th>Tags</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr
                  key={person.id}
                  className="clickable"
                  onClick={() => setDetailPerson(person)}
                >
                  <td>
                    <div className="table-primary-cell">
                      <div className="table-avatar">
                        {person.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong>{person.displayName}</strong>
                        {person.address?.city && (
                          <small style={{ color: "var(--muted)", display: "block" }}>
                            {person.address.city}, {person.address.state || ""}
                          </small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      {person.email && <div>{person.email}</div>}
                      {person.primaryPhone && (
                        <small style={{ color: "var(--muted)" }}>
                          {person.primaryPhone}
                        </small>
                      )}
                      {!person.email && !person.primaryPhone && (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {person.types.map((t) => (
                        <Badge key={t.type} tone="blue">
                          {t.type}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {person.tags.length > 0 ? (
                        person.tags.map((t) => (
                          <Badge key={t.tagId} tone="neutral">
                            {t.tag.name}
                          </Badge>
                        ))
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge tone={person.status === "ACTIVE" ? "green" : "neutral"}>
                      {person.status}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <button
                        className="btn-icon"
                        title="Edit"
                        onClick={() => openEditModal(person)}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                      {person.status === "ACTIVE" && (
                        <button
                          className="btn-icon"
                          title="Archive"
                          onClick={() => handleArchive(person.id)}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Person Detail Drawer */}
      <Drawer
        isOpen={Boolean(detailPerson)}
        onClose={() => setDetailPerson(null)}
        title={detailPerson?.displayName || "Person Details"}
        subtitle="Directory Profile & Timeline"
      >
        {detailPerson && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="key-value-list">
              <div className="key-value-item">
                <label>Email</label>
                <span>{detailPerson.email || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Primary Phone</label>
                <span>{detailPerson.primaryPhone || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Alternate Phone</label>
                <span>{detailPerson.alternatePhone || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Status</label>
                <span>
                  <Badge tone={detailPerson.status === "ACTIVE" ? "green" : "neutral"}>
                    {detailPerson.status}
                  </Badge>
                </span>
              </div>
            </div>

            {detailPerson.address && (
              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                  Address
                </label>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {[
                    detailPerson.address.street,
                    detailPerson.address.city,
                    detailPerson.address.state,
                    detailPerson.address.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "No address provided"}
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                Person Types
              </label>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {detailPerson.types.map((t) => (
                  <Badge key={t.type} tone="blue">
                    {t.type}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                Tags
              </label>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {detailPerson.tags.length > 0 ? (
                  detailPerson.tags.map((t) => (
                    <Badge key={t.tagId} tone="neutral">
                      {t.tag.name}
                    </Badge>
                  ))
                ) : (
                  <small style={{ color: "var(--muted)" }}>No tags assigned</small>
                )}
              </div>
            </div>

            {detailPerson.notes && (
              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                  Notes
                </label>
                <p style={{ fontSize: 13, background: "#f8fafc", padding: 10, borderRadius: 8, margin: "4px 0 0" }}>
                  {detailPerson.notes}
                </p>
              </div>
            )}

            {/* Quick module links */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                Quick Actions
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <a
                  href={`/crm?action=new&personId=${detailPerson.id}&name=${encodeURIComponent(detailPerson.displayName)}`}
                  className="btn btn-secondary btn-sm"
                >
                  <Icon name="crm" size={14} />
                  <span>Create Lead</span>
                </a>
                <a
                  href={`/finance?action=new-invoice&personId=${detailPerson.id}`}
                  className="btn btn-secondary btn-sm"
                >
                  <Icon name="finance" size={14} />
                  <span>New Invoice</span>
                </a>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    openEditModal(detailPerson);
                  }}
                >
                  <Icon name="edit" size={14} />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>

            {/* Activity History */}
            {detailPerson.activities && detailPerson.activities.length > 0 && (
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                  Recent Activity
                </label>
                <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
                  {detailPerson.activities.map((act) => (
                    <li
                      key={act.id}
                      style={{
                        padding: "8px 10px",
                        background: "#f8fafc",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <strong>{act.summary}</strong>
                      <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
                        {new Date(act.createdAt).toLocaleString()} · {act.actor?.name || "System"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create Person Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add New Person"
        subtitle="Register customer, student, member or employee"
        maxWidth={560}
      >
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {formError && (
            <div style={{ padding: 10, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12 }}>
              {formError}
            </div>
          )}

          {duplicateWarnings.length > 0 && (
            <div style={{ padding: 10, background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 12 }}>
              <strong>Potential duplicate found:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {duplicateWarnings.map((d) => (
                  <li key={d.id}>
                    {d.displayName} ({d.email || d.primaryPhone})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group full">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Sharma"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="ramesh@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Primary Phone</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div className="form-group full">
              <label>Alternate Phone</label>
              <input
                type="tel"
                placeholder="Optional second number"
                value={formAltPhone}
                onChange={(e) => setFormAltPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Person Types</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {(["CUSTOMER", "STUDENT", "MEMBER", "EMPLOYEE"] as PersonType[]).map((type) => {
                const checked = formTypes.includes(type);
                return (
                  <label
                    key={type}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: checked ? "var(--brand)" : "var(--line)",
                      background: checked ? "#eff6ff" : "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setFormTypes((curr) =>
                          checked ? curr.filter((t) => t !== type) : [...curr, type],
                        );
                      }}
                      style={{ display: "none" }}
                    />
                    <span>{type}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="form-group">
              <label>Tags</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {tags.map((tag) => {
                  const checked = formSelectedTags.includes(tag.id);
                  return (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={() =>
                        setFormSelectedTags((curr) =>
                          checked ? curr.filter((id) => id !== tag.id) : [...curr, tag.id],
                        )
                      }
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid",
                        borderColor: checked ? "var(--brand)" : "var(--line)",
                        background: checked ? "#eff6ff" : "#fff",
                        color: checked ? "var(--brand)" : "var(--ink)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                placeholder="e.g. Mumbai"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>State</label>
              <input
                type="text"
                placeholder="e.g. Maharashtra"
                value={formState}
                onChange={(e) => setFormState(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              rows={2}
              placeholder="Additional background notes..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formBusy}>
              {formBusy ? "Saving…" : "Create Person"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Person Modal */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Person"
        subtitle="Update contact and profile details"
        maxWidth={560}
      >
        <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {formError && (
            <div style={{ padding: 10, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12 }}>
              {formError}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group full">
              <label>Full Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Primary Phone</label>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div className="form-group full">
              <label>Alternate Phone</label>
              <input
                type="tel"
                value={formAltPhone}
                onChange={(e) => setFormAltPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Person Types</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {(["CUSTOMER", "STUDENT", "MEMBER", "EMPLOYEE"] as PersonType[]).map((type) => {
                const checked = formTypes.includes(type);
                return (
                  <label
                    key={type}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: checked ? "var(--brand)" : "var(--line)",
                      background: checked ? "#eff6ff" : "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setFormTypes((curr) =>
                          checked ? curr.filter((t) => t !== type) : [...curr, type],
                        );
                      }}
                      style={{ display: "none" }}
                    />
                    <span>{type}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="form-group">
              <label>Tags</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {tags.map((tag) => {
                  const checked = formSelectedTags.includes(tag.id);
                  return (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={() =>
                        setFormSelectedTags((curr) =>
                          checked ? curr.filter((id) => id !== tag.id) : [...curr, tag.id],
                        )
                      }
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid",
                        borderColor: checked ? "var(--brand)" : "var(--line)",
                        background: checked ? "#eff6ff" : "#fff",
                        color: checked ? "var(--brand)" : "var(--ink)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>State</label>
              <input
                type="text"
                value={formState}
                onChange={(e) => setFormState(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formBusy}>
              {formBusy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Tags Modal */}
      <Modal
        isOpen={tagsModalOpen}
        onClose={() => setTagsModalOpen(false)}
        title="Manage Directory Tags"
        subtitle="Organize people with custom labels"
        maxWidth={440}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form onSubmit={handleCreateTag} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="New tag name (e.g. VIP, Morning Batch)"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 8 }}
              required
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={tagBusy}>
              {tagBusy ? "Adding…" : "Add Tag"}
            </button>
          </form>

          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
              Existing Tags
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {tags.length > 0 ? (
                tags.map((t) => (
                  <Badge key={t.id} tone="neutral">
                    {t.name}
                  </Badge>
                ))
              ) : (
                <small style={{ color: "var(--muted)" }}>No tags created yet.</small>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportResult(null);
        }}
        title="Import People from CSV"
        subtitle="Bulk import customers, students or members"
        maxWidth={560}
      >
        <form onSubmit={handleImportCsv} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            Paste CSV data with headers: <code>displayName, email, phone, type, notes</code>
          </p>
          <textarea
            rows={7}
            placeholder={`displayName,email,phone,type\nAnil Verma,anil@example.com,+919876543210,CUSTOMER\nPooja Sharma,pooja@example.com,+919876543211,STUDENT`}
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
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                fontSize: 12,
                background: importResult.imported > 0 ? "#dcfce7" : "#fee2e2",
                color: importResult.imported > 0 ? "#15803d" : "#b91c1c",
              }}
            >
              <strong>
                {importResult.imported > 0
                  ? `Successfully imported ${importResult.imported} records!`
                  : "Import completed with errors."}
              </strong>
              {importResult.errors && importResult.errors.length > 0 && (
                <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                  {importResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 6 }}>
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
    </AppShell>
  );
}

export default function PeoplePage() {
  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <div className="state-spinner" />
          <p>Loading directory…</p>
        </div>
      }
    >
      <PeopleContent />
    </Suspense>
  );
}

