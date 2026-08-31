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
import { authFetch, getApiUrl } from "@/lib/api";
import {
  buildNavItems,
  getCachedWorkspaceContext,
  saveCachedWorkspaceContext,
  saveActiveServicesToStorage,
} from "@/lib/nav";

import { Country, State, City } from "country-state-city";

const ALL_COUNTRIES = Country.getAllCountries().sort((a, b) =>
  a.name.localeCompare(b.name),
);

const ALL_INDIAN_STATES = State.getStatesOfCountry("IN").sort((a, b) =>
  a.name.localeCompare(b.name),
);

const COUNTRY_DIAL_CODES = [
  { code: "+91", label: "+ 91 (India)", iso: "IN" },
  { code: "+1", label: "+ 1 (US / Canada)", iso: "US" },
  { code: "+44", label: "+ 44 (UK)", iso: "GB" },
  { code: "+971", label: "+ 971 (UAE)", iso: "AE" },
  { code: "+65", label: "+ 65 (Singapore)", iso: "SG" },
  { code: "+61", label: "+ 61 (Australia)", iso: "AU" },
  { code: "+966", label: "+ 966 (Saudi Arabia)", iso: "SA" },
  { code: "+974", label: "+ 974 (Qatar)", iso: "QA" },
  { code: "+968", label: "+ 968 (Oman)", iso: "OM" },
  { code: "+977", label: "+ 977 (Nepal)", iso: "NP" },
  { code: "+880", label: "+ 880 (Bangladesh)", iso: "BD" },
  { code: "+94", label: "+ 94 (Sri Lanka)", iso: "LK" },
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
    addressLine1?: string;
    addressLine2?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    pincode?: string;
    country?: string;
    dateOfBirth?: string;
    dob?: string;
    guardianName?: string;
    admissionNumber?: string;
    admissionDate?: string;
  } | null;
  notes: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  types: Array<{ type: PersonType }>;
  tags: Array<{ tagId: string; tag: Tag }>;
  activities?: Array<{
    id: string;
    action: string;
    summary?: string;
    actorName?: string;
    actor?: { name: string | null; email: string };
    createdAt: string;
  }>;
};

function PeopleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = getApiUrl();

  // Data states
  const [people, setPeople] = useState<Person[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter states
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  // Context & AppShell info (Instant 0ms cached state)
  const cached = getCachedWorkspaceContext();
  const [orgName, setOrgName] = useState(cached.orgName);
  const [userName, setUserName] = useState(cached.userName);
  const [userRole, setUserRole] = useState(cached.userRole);
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);
  const [activeServiceCodes, setActiveServiceCodes] = useState<string[]>(cached.activeServices);

  // Modals & Drawers
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailPerson, setDetailPerson] = useState<Person | null>(null);
  const [personInvoices, setPersonInvoices] = useState<
    Array<{
      id: string;
      invoiceNumber: string;
      totalMinor: number;
      balanceDueMinor: number;
      status: string;
      issueDate: string;
    }>
  >([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Segmented Modal Navigation Tab
  const [modalActiveTab, setModalActiveTab] = useState<"personal" | "address" | "more">("personal");

  // Form states - Personal info
  const [formName, setFormName] = useState("");
  const [formNameTouched, setFormNameTouched] = useState(false);
  const [formPrimaryCountryCode, setFormPrimaryCountryCode] = useState("+91");
  const [formPhone, setFormPhone] = useState("");
  const [formAltCountryCode, setFormAltCountryCode] = useState("+91");
  const [formAltPhone, setFormAltPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDob, setFormDob] = useState("");
  const [formTypes, setFormTypes] = useState<PersonType[]>(["MEMBER"]);
  const [formSelectedTags, setFormSelectedTags] = useState<string[]>([]);

  // Form states - Address details
  const [formAddressLine1, setFormAddressLine1] = useState("");
  const [formAddressLine2, setFormAddressLine2] = useState("");
  const [formCountry, setFormCountry] = useState("India");
  const [formState, setFormState] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formPincode, setFormPincode] = useState("");

  // Form states - More info
  const [formGuardianName, setFormGuardianName] = useState("");
  const [formAdmissionNo, setFormAdmissionNo] = useState("");
  const [formAdmissionDate, setFormAdmissionDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

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

  // Computed state and city lists for address selection
  const selectedCountryObj = ALL_COUNTRIES.find(
    (c) =>
      c.name.toLowerCase() === formCountry.toLowerCase() ||
      c.isoCode.toLowerCase() === formCountry.toLowerCase(),
  );
  const countryIso = selectedCountryObj ? selectedCountryObj.isoCode : "IN";

  const availableStates = State.getStatesOfCountry(countryIso).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const selectedStateObj = availableStates.find(
    (s) =>
      s.name.toLowerCase() === formState.trim().toLowerCase() ||
      s.isoCode.toLowerCase() === formState.trim().toLowerCase(),
  );

  const availableCities = selectedStateObj
    ? City.getCitiesOfState(countryIso, selectedStateObj.isoCode).sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    : [];

  const isCustomState = Boolean(
    formState && !selectedStateObj && formState !== "Other",
  );

  const isCustomCity = Boolean(
    formCity &&
      selectedStateObj &&
      !availableCities.some(
        (c) => c.name.toLowerCase() === formCity.trim().toLowerCase(),
      ) &&
      formCity !== "Other",
  );

  // Validation
  const isNameValid = formName.trim().length >= 3;
  const isPhoneValid = formPhone.trim().length >= 6;
  const isFormValid = isNameValid && isPhoneValid;

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

      const res = await authFetch(`${api}/people?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to load directory records.");
      }
      const data = await res.json();
      setPeople(data.items || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, search, activeTab, selectedTag]);

  // Load tags
  const loadTags = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/people/tags`, { credentials: "include" });
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
    if (action === "new") {
      resetForm();
      setCreateOpen(true);
    }
    if (personId) {
      authFetch(`${api}/people/${personId}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((p) => {
          if (p) setDetailPerson(p);
        })
        .catch(() => {});
    }
  }, [searchParams, api]);

  // Load fee invoices & payment history for detailPerson
  useEffect(() => {
    if (!detailPerson) {
      setPersonInvoices([]);
      return;
    }
    setInvoicesLoading(true);
    authFetch(`${api}/finance/invoices?personId=${detailPerson.id}&limit=20`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.items) {
          setPersonInvoices(data.items);
        } else {
          setPersonInvoices([]);
        }
      })
      .catch(() => {
        setPersonInvoices([]);
      })
      .finally(() => {
        setInvoicesLoading(false);
      });
  }, [detailPerson, api]);

  // Check duplicates on email/phone change during create
  useEffect(() => {
    if (!createOpen || (!formEmail && !formPhone)) {
      setDuplicateWarnings([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(`${api}/people/duplicates`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: formEmail || undefined,
            phone: formPhone ? `${formPrimaryCountryCode} ${formPhone}`.trim() : undefined,
          }),
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
  }, [formEmail, formPhone, formPrimaryCountryCode, createOpen, api]);

  function resetForm() {
    setModalActiveTab("personal");
    setFormName("");
    setFormNameTouched(false);
    setFormPrimaryCountryCode("+91");
    setFormPhone("");
    setFormAltCountryCode("+91");
    setFormAltPhone("");
    setFormEmail("");
    setFormDob("");
    setFormAddressLine1("");
    setFormAddressLine2("");
    setFormCountry("India");
    setFormState("");
    setFormCity("");
    setFormPincode("");
    setFormGuardianName("");
    setFormAdmissionNo("");
    setFormAdmissionDate("");
    setFormNotes("");
    setFormTypes(["MEMBER"]);
    setFormSelectedTags([]);
    setFormError("");
    setDuplicateWarnings([]);
  }

  function openEditModal(person: Person) {
    setModalActiveTab("personal");
    setFormName(person.displayName);
    setFormNameTouched(false);

    // Extract primary phone code
    let pPhone = person.primaryPhone || "";
    let pCode = "+91";
    if (pPhone.startsWith("+")) {
      const match = COUNTRY_DIAL_CODES.find((c) => pPhone.startsWith(c.code));
      if (match) {
        pCode = match.code;
        pPhone = pPhone.slice(match.code.length).trim();
      } else {
        const parts = pPhone.split(" ");
        if (parts.length > 1 && parts[0]) {
          pCode = parts[0];
          pPhone = parts.slice(1).join(" ");
        }
      }
    }
    setFormPrimaryCountryCode(pCode);
    setFormPhone(pPhone);

    // Extract alt phone code
    let aPhone = person.alternatePhone || "";
    let aCode = "+91";
    if (aPhone.startsWith("+")) {
      const match = COUNTRY_DIAL_CODES.find((c) => aPhone.startsWith(c.code));
      if (match) {
        aCode = match.code;
        aPhone = aPhone.slice(match.code.length).trim();
      } else {
        const parts = aPhone.split(" ");
        if (parts.length > 1 && parts[0]) {
          aCode = parts[0];
          aPhone = parts.slice(1).join(" ");
        }
      }
    }
    setFormAltCountryCode(aCode);
    setFormAltPhone(aPhone);

    setFormEmail(person.email || "");
    setFormNotes(person.notes || "");

    const addr = person.address || {};
    setFormAddressLine1(addr.addressLine1 || addr.street || "");
    setFormAddressLine2(addr.addressLine2 || "");
    setFormCountry(addr.country || "India");
    setFormState(addr.state || "");
    setFormCity(addr.city || "");
    setFormPincode(addr.pincode || addr.postalCode || "");
    setFormDob(addr.dateOfBirth || addr.dob || "");
    setFormGuardianName(addr.guardianName || "");
    setFormAdmissionNo(addr.admissionNumber || "");
    setFormAdmissionDate(addr.admissionDate || "");

    const firstType = person.types[0]?.type;
    setFormTypes(firstType ? [firstType] : ["MEMBER"]);
    setFormSelectedTags(person.tags.map((t) => t.tagId));
    setEditOpen(true);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!isNameValid || !isPhoneValid) {
      setFormNameTouched(true);
      setFormError("Please provide a valid member name (at least 3 characters) and primary phone number.");
      return;
    }
    setFormBusy(true);
    setFormError("");
    try {
      const finalState = formState === "Other" ? "" : formState.trim();
      const finalCity = formCity === "Other" ? "" : formCity.trim();
      const finalPincode = formPincode.trim();
      const fullStreet = [formAddressLine1.trim(), formAddressLine2.trim()].filter(Boolean).join(", ");

      const fullPrimaryPhone = formPhone.trim()
        ? (formPhone.startsWith("+") ? formPhone.trim() : `${formPrimaryCountryCode} ${formPhone.trim()}`)
        : undefined;

      const fullAltPhone = formAltPhone.trim()
        ? (formAltPhone.startsWith("+") ? formAltPhone.trim() : `${formAltCountryCode} ${formAltPhone.trim()}`)
        : undefined;

      const addressPayload: Record<string, string> = {};
      if (formAddressLine1.trim()) addressPayload.addressLine1 = formAddressLine1.trim();
      if (formAddressLine2.trim()) addressPayload.addressLine2 = formAddressLine2.trim();
      if (fullStreet) addressPayload.street = fullStreet;
      if (formCountry.trim()) addressPayload.country = formCountry.trim();
      if (finalState) addressPayload.state = finalState;
      if (finalCity) addressPayload.city = finalCity;
      if (finalPincode) {
        addressPayload.pincode = finalPincode;
        addressPayload.postalCode = finalPincode;
      }
      if (formDob.trim()) {
        addressPayload.dateOfBirth = formDob.trim();
        addressPayload.dob = formDob.trim();
      }
      if (formGuardianName.trim()) addressPayload.guardianName = formGuardianName.trim();
      if (formAdmissionNo.trim()) addressPayload.admissionNumber = formAdmissionNo.trim();
      if (formAdmissionDate.trim()) addressPayload.admissionDate = formAdmissionDate.trim();

      const res = await authFetch(`${api}/people`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: formName.trim(),
          email: formEmail.trim() || undefined,
          primaryPhone: fullPrimaryPhone,
          alternatePhone: fullAltPhone,
          notes: formNotes.trim() || undefined,
          address: Object.keys(addressPayload).length > 0 ? addressPayload : undefined,
          types: formTypes.length > 0 ? formTypes : ["MEMBER"],
          tagIds: formSelectedTags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create member record.");
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
    if (!isNameValid || !isPhoneValid) {
      setFormNameTouched(true);
      setFormError("Please provide a valid member name (at least 3 characters) and primary phone number.");
      return;
    }
    setFormBusy(true);
    setFormError("");
    try {
      const finalState = formState === "Other" ? "" : formState.trim();
      const finalCity = formCity === "Other" ? "" : formCity.trim();
      const finalPincode = formPincode.trim();
      const fullStreet = [formAddressLine1.trim(), formAddressLine2.trim()].filter(Boolean).join(", ");

      const fullPrimaryPhone = formPhone.trim()
        ? (formPhone.startsWith("+") ? formPhone.trim() : `${formPrimaryCountryCode} ${formPhone.trim()}`)
        : undefined;

      const fullAltPhone = formAltPhone.trim()
        ? (formAltPhone.startsWith("+") ? formAltPhone.trim() : `${formAltCountryCode} ${formAltPhone.trim()}`)
        : undefined;

      const addressPayload: Record<string, string> = {};
      if (formAddressLine1.trim()) addressPayload.addressLine1 = formAddressLine1.trim();
      if (formAddressLine2.trim()) addressPayload.addressLine2 = formAddressLine2.trim();
      if (fullStreet) addressPayload.street = fullStreet;
      if (formCountry.trim()) addressPayload.country = formCountry.trim();
      if (finalState) addressPayload.state = finalState;
      if (finalCity) addressPayload.city = finalCity;
      if (finalPincode) {
        addressPayload.pincode = finalPincode;
        addressPayload.postalCode = finalPincode;
      }
      if (formDob.trim()) {
        addressPayload.dateOfBirth = formDob.trim();
        addressPayload.dob = formDob.trim();
      }
      if (formGuardianName.trim()) addressPayload.guardianName = formGuardianName.trim();
      if (formAdmissionNo.trim()) addressPayload.admissionNumber = formAdmissionNo.trim();
      if (formAdmissionDate.trim()) addressPayload.admissionDate = formAdmissionDate.trim();

      const res = await authFetch(`${api}/people/${detailPerson.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: formName.trim(),
          email: formEmail.trim() || undefined,
          primaryPhone: fullPrimaryPhone,
          alternatePhone: fullAltPhone,
          notes: formNotes.trim() || undefined,
          address: Object.keys(addressPayload).length > 0 ? addressPayload : undefined,
          types: formTypes.length > 0 ? formTypes : ["MEMBER"],
          tagIds: formSelectedTags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update member details.");
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
    if (!confirm("Are you sure you want to archive this member / person?")) return;
    try {
      const res = await authFetch(`${api}/people/${personId}/archive`, {
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
      const res = await authFetch(`${api}/people/tags`, {
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
      const res = await authFetch(`${api}/people/import`, {
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

  const tabItems = [
    { id: "ALL", label: "All Directory" },
    { id: "MEMBER", label: "Members" },
    { id: "STUDENT", label: "Students / Learners" },
    { id: "CUSTOMER", label: "Customers / Clients" },
    { id: "EMPLOYEE", label: "Employees / Staff" },
    { id: "ARCHIVED", label: "Archived" },
  ];

  const nav: NavItem[] = buildNavItems(activeServiceCodes);

  // Reusable render function for the 2-column segmented Add/Edit Member Form
  const renderMemberForm = (isEdit: boolean) => (
    <div className="add-member-dialog">
      {/* Left Sidebar Navigation */}
      <aside className="add-member-nav">
        <button
          type="button"
          className={`add-member-nav-btn ${modalActiveTab === "personal" ? "active" : ""}`}
          onClick={() => setModalActiveTab("personal")}
        >
          <Icon name="user" size={15} />
          <span>Personal information</span>
        </button>

        <button
          type="button"
          className={`add-member-nav-btn ${modalActiveTab === "address" ? "active" : ""}`}
          onClick={() => setModalActiveTab("address")}
        >
          <Icon name="tag" size={15} />
          <span>Address details</span>
        </button>

        <button
          type="button"
          className={`add-member-nav-btn ${modalActiveTab === "more" ? "active" : ""}`}
          onClick={() => setModalActiveTab("more")}
        >
          <Icon name="activity" size={15} />
          <span>More info</span>
        </button>
      </aside>

      {/* Right Form Content */}
      <div className="add-member-content">
        {formError && (
          <div style={{ padding: "10px 12px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12 }}>
            ⚠️ {formError}
          </div>
        )}

        {duplicateWarnings.length > 0 && (
          <div style={{ padding: "10px 12px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 12 }}>
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

        {/* Section 1: Personal Information */}
        <section
          className="add-member-section"
          style={{ display: modalActiveTab === "personal" ? "flex" : "none" }}
        >
          <h3 className="add-member-section-title">Personal information</h3>

          <div className="add-member-grid">
            {/* Name */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onBlur={() => setFormNameTouched(true)}
                className={formNameTouched && !isNameValid ? "add-member-input-error" : ""}
                required
                autoFocus={!isEdit}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              {formNameTouched && !isNameValid && (
                <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 600, display: "block", marginTop: 4 }}>
                  Minimum length should be 3
                </span>
              )}
            </div>

            {/* Primary Number */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Primary Number <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div className="add-member-phone-input">
                <select
                  className="add-member-country-select"
                  value={formPrimaryCountryCode}
                  onChange={(e) => setFormPrimaryCountryCode(e.target.value)}
                >
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  className="add-member-phone-field"
                  placeholder="Enter phone number"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="add-member-grid">
            {/* Alternate Number */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Alternate Number
              </label>
              <div className="add-member-phone-input">
                <select
                  className="add-member-country-select"
                  value={formAltCountryCode}
                  onChange={(e) => setFormAltCountryCode(e.target.value)}
                >
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  className="add-member-phone-field"
                  placeholder="Enter phone number"
                  value={formAltPhone}
                  onChange={(e) => setFormAltPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Email ID */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Email ID
              </label>
              <input
                type="email"
                placeholder="Enter email ID"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div className="add-member-grid single-col">
            {/* Date of Birth */}
            <div className="form-group" style={{ margin: 0, maxWidth: "50%" }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Date of Birth
              </label>
              <input
                type="date"
                value={formDob}
                onChange={(e) => setFormDob(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Member / Person Type Pills */}
          <div className="form-group" style={{ margin: 0, paddingTop: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>
              Directory Category
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { type: "MEMBER" as PersonType, label: "🤝 Member" },
                { type: "STUDENT" as PersonType, label: "🎓 Student / Learner" },
                { type: "CUSTOMER" as PersonType, label: "💼 Customer / Client" },
                { type: "EMPLOYEE" as PersonType, label: "👔 Staff / Employee" },
              ].map(({ type, label }) => {
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
                      border: "1.5px solid",
                      borderColor: checked ? "var(--brand)" : "#cbd5e1",
                      background: checked ? "#eff6ff" : "#ffffff",
                      color: checked ? "#1d4ed8" : "#334155",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="radio"
                      name="personCategory"
                      checked={checked}
                      onChange={() => setFormTypes([type])}
                      style={{ display: "none" }}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>
                Tags
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                        padding: "3px 10px",
                        borderRadius: 6,
                        border: "1px solid",
                        borderColor: checked ? "var(--brand)" : "var(--line)",
                        background: checked ? "#eff6ff" : "#fff",
                        color: checked ? "var(--brand)" : "var(--ink)",
                        fontSize: 11.5,
                        fontWeight: 600,
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
        </section>

        {/* Section 2: Address Details */}
        <section
          className="add-member-section"
          style={{ display: modalActiveTab === "address" ? "flex" : "none" }}
        >
          <h3 className="add-member-section-title">Address details</h3>

          <div className="add-member-grid">
            {/* Address Line 1 */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Address Line 1
              </label>
              <input
                type="text"
                placeholder="Eg: House no.56"
                value={formAddressLine1}
                onChange={(e) => setFormAddressLine1(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            {/* Address Line 2 */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Address Line 2
              </label>
              <input
                type="text"
                placeholder="Eg: Street road"
                value={formAddressLine2}
                onChange={(e) => setFormAddressLine2(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div className="add-member-grid">
            {/* Country */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Country
              </label>
              <select
                value={formCountry}
                onChange={(e) => {
                  setFormCountry(e.target.value);
                  setFormState("");
                  setFormCity("");
                }}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                  background: "#fff",
                }}
              >
                <option value="">Select Country</option>
                {ALL_COUNTRIES.map((c) => (
                  <option key={c.isoCode} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* State */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                State
              </label>
              <select
                value={
                  selectedStateObj
                    ? selectedStateObj.name
                    : formState === "Other" || isCustomState
                      ? "Other"
                      : ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setFormState(val);
                  setFormCity("");
                }}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                  background: "#fff",
                }}
              >
                <option value="">Select State</option>
                {availableStates.map((s) => (
                  <option key={s.isoCode} value={s.name}>
                    {s.name}
                  </option>
                ))}
                <option value="Other">Other (Enter manually)</option>
              </select>
              {(formState === "Other" || isCustomState) && (
                <input
                  type="text"
                  style={{ marginTop: 6, width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}
                  placeholder="Enter state name..."
                  value={formState === "Other" ? "" : formState}
                  onChange={(e) => setFormState(e.target.value || "Other")}
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="add-member-grid">
            {/* City */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                City
              </label>
              {availableCities.length > 0 ? (
                <>
                  <select
                    value={
                      availableCities.some((c) => c.name.toLowerCase() === formCity.trim().toLowerCase())
                        ? formCity
                        : formCity === "Other" || isCustomCity
                          ? "Other"
                          : ""
                    }
                    onChange={(e) => setFormCity(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      fontSize: 13,
                      outline: "none",
                      background: "#fff",
                    }}
                  >
                    <option value="">Enter City / Select ({availableCities.length})</option>
                    {availableCities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="Other">Other (Enter manually)</option>
                  </select>
                  {(formCity === "Other" || isCustomCity) && (
                    <input
                      type="text"
                      style={{ marginTop: 6, width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}
                      placeholder="Enter city / town name..."
                      value={formCity === "Other" ? "" : formCity}
                      onChange={(e) => setFormCity(e.target.value || "Other")}
                      autoFocus
                    />
                  )}
                </>
              ) : (
                <input
                  type="text"
                  placeholder="Enter City"
                  value={formCity === "Other" ? "" : formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              )}
            </div>

            {/* Pincode */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Pincode
              </label>
              <input
                type="text"
                placeholder="Enter pincode"
                value={formPincode}
                onChange={(e) => setFormPincode(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          </div>
        </section>

        {/* Section 3: More Info */}
        <section
          className="add-member-section"
          style={{ display: modalActiveTab === "more" ? "flex" : "none" }}
        >
          <h3 className="add-member-section-title">More info</h3>

          <div className="add-member-grid">
            {/* Guardian Name */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Guardian Name
              </label>
              <input
                type="text"
                placeholder="Enter Name"
                value={formGuardianName}
                onChange={(e) => setFormGuardianName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            {/* Admission Number */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Admission Number
              </label>
              <input
                type="text"
                placeholder="Enter admission number"
                value={formAdmissionNo}
                onChange={(e) => setFormAdmissionNo(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div className="add-member-grid single-col">
            {/* Admission Date */}
            <div className="form-group" style={{ margin: 0, maxWidth: "50%" }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
                Admission Date
              </label>
              <input
                type="date"
                value={formAdmissionDate}
                onChange={(e) => setFormAdmissionDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
              Additional Notes
            </label>
            <textarea
              rows={3}
              placeholder="Background information, special requirements, or internal notes..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/people"
      nav={nav}
      userName={userName}
      userRole={userRole}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
      onPrefetch={(href) => router.prefetch(href)}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="people" size={14} /> Shared Directory
          </p>
          <h1>People & Directory</h1>
          <p className="subheading">
            Centralized directory for members, students, customers / clients, and staff.
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
            <span>Add Member</span>
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
          title="No member records found"
          description={
            search || selectedTag || activeTab !== "ALL"
              ? "Try adjusting your search or active filters."
              : "Start by adding your first member, student, or customer to your directory."
          }
          actionLabel="Add Member"
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
                <th>Person / Member</th>
                <th>Contact</th>
                <th>Category</th>
                <th>Location</th>
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
                        {person.address?.guardianName && (
                          <small style={{ color: "var(--muted)", display: "block" }}>
                            Guardian: {person.address.guardianName}
                          </small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      {person.primaryPhone && (
                        <div style={{ fontWeight: 600 }}>{person.primaryPhone}</div>
                      )}
                      {person.email && (
                        <small style={{ color: "var(--muted)", display: "block" }}>
                          {person.email}
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
                    {person.address?.city || person.address?.state ? (
                      <span style={{ fontSize: 12.5, color: "var(--ink)" }}>
                        {[person.address.city, person.address.state].filter(Boolean).join(", ")}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
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
                        title="Edit Details"
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
        title={detailPerson?.displayName || "Member Details"}
        subtitle="Directory Profile & Activity"
      >
        {detailPerson && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="key-value-list">
              <div className="key-value-item">
                <label>Primary Phone</label>
                <span style={{ fontWeight: 700 }}>{detailPerson.primaryPhone || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Alternate Phone</label>
                <span>{detailPerson.alternatePhone || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Email ID</label>
                <span>{detailPerson.email || "—"}</span>
              </div>
              <div className="key-value-item">
                <label>Date of Birth</label>
                <span>
                  {detailPerson.address?.dateOfBirth || detailPerson.address?.dob || "—"}
                </span>
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

            {/* Address Details */}
            {detailPerson.address && (
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  📍 Address Details
                </label>
                <div style={{ fontSize: 13, marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                  {detailPerson.address.addressLine1 && (
                    <div><strong>Line 1:</strong> {detailPerson.address.addressLine1}</div>
                  )}
                  {detailPerson.address.addressLine2 && (
                    <div><strong>Line 2:</strong> {detailPerson.address.addressLine2}</div>
                  )}
                  <div>
                    <strong>Location:</strong>{" "}
                    {[
                      detailPerson.address.city,
                      detailPerson.address.state,
                      detailPerson.address.pincode || detailPerson.address.postalCode,
                      detailPerson.address.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || detailPerson.address.street || "No address specified"}
                  </div>
                </div>
              </div>
            )}

            {/* More Info Details */}
            {(detailPerson.address?.guardianName ||
              detailPerson.address?.admissionNumber ||
              detailPerson.address?.admissionDate) && (
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  📋 Admission & Guardian Info
                </label>
                <div style={{ fontSize: 13, marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {detailPerson.address.guardianName && (
                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Guardian Name</small>
                      <strong>{detailPerson.address.guardianName}</strong>
                    </div>
                  )}
                  {detailPerson.address.admissionNumber && (
                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Admission No.</small>
                      <strong>{detailPerson.address.admissionNumber}</strong>
                    </div>
                  )}
                  {detailPerson.address.admissionDate && (
                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Admission Date</small>
                      <strong>{detailPerson.address.admissionDate}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                Categories
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

            {/* Student Fees & Month-Wise Billing Card */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  🎓 Fees & Monthly Billing
                </label>
                <a
                  href={`/finance?action=new-invoice&personId=${detailPerson.id}`}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--brand)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Icon name="plus" size={12} />
                  <span>+ Create Custom Bill</span>
                </a>
              </div>

              {/* Month-Wise 1-Click Fee Selector */}
              <div style={{ background: "#f0fdf4", padding: "10px 12px", borderRadius: 10, border: "1px solid #bbf7d0", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 750, color: "#166534", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>⚡ 1-Click Month Fee Bill ({new Date().getFullYear()}–{new Date().getFullYear() + 1})</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#15803d" }}>₹3,500/mo</span>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {[
                    "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"
                  ].map((m) => {
                    const fullMonth = {
                      Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August",
                      Sep: "September", Oct: "October", Nov: "November", Dec: "December",
                      Jan: "January", Feb: "February", Mar: "March"
                    }[m] || m;
                    const year = ["Jan", "Feb", "Mar"].includes(m) ? new Date().getFullYear() + 1 : new Date().getFullYear();
                    const feeDesc = `🎓 Monthly Academic / Tuition Fees — ${fullMonth} ${year}`;
                    return (
                      <a
                        key={m}
                        href={`/finance?action=new-invoice&personId=${detailPerson.id}&description=${encodeURIComponent(feeDesc)}&price=3500`}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          border: "1px solid #86efac",
                          background: "#ffffff",
                          color: "#166534",
                          fontSize: 11,
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                        }}
                        title={`Generate fee bill for ${fullMonth} ${year}`}
                      >
                        + {m}
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Invoices List / Payment Status */}
              {invoicesLoading ? (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>Loading fee history…</div>
              ) : personInvoices.length > 0 ? (
                <div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 12 }}>
                    <div style={{ flex: 1, background: "#f8fafc", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)" }}>
                      <small style={{ color: "var(--muted)", fontSize: 10 }}>Total Billed</small>
                      <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14 }}>
                        ₹{(personInvoices.reduce((acc, inv) => acc + inv.totalMinor, 0) / 100).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div style={{ flex: 1, background: "#f8fafc", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)" }}>
                      <small style={{ color: "var(--muted)", fontSize: 10 }}>Pending Dues</small>
                      <div style={{ fontWeight: 800, color: personInvoices.some(i => i.balanceDueMinor > 0) ? "#b91c1c" : "#15803d", fontSize: 14 }}>
                        ₹{(personInvoices.reduce((acc, inv) => acc + inv.balanceDueMinor, 0) / 100).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {personInvoices.map((inv) => (
                      <li
                        key={inv.id}
                        style={{
                          padding: "8px 10px",
                          background: "#ffffff",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <strong>{inv.invoiceNumber}</strong>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            {new Date(inv.issueDate).toLocaleDateString()} · ₹{(inv.totalMinor / 100).toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700,
                              background:
                                inv.status === "PAID"
                                  ? "#dcfce7"
                                  : inv.status === "PARTIALLY_PAID"
                                    ? "#fef3c7"
                                    : "#dbeafe",
                              color:
                                inv.status === "PAID"
                                  ? "#15803d"
                                  : inv.status === "PARTIALLY_PAID"
                                    ? "#b45309"
                                    : "#1d4ed8",
                            }}
                          >
                            {inv.status}
                          </span>
                          <a
                            href={`/finance?invoiceId=${inv.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "2px 8px", fontSize: 11, height: 26 }}
                          >
                            {inv.balanceDueMinor > 0 ? "Collect Due" : "View"}
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "4px 0" }}>
                  No fee bills issued yet for this member.
                </div>
              )}
            </div>

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
                      <strong>{act.summary || act.action}</strong>
                      <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
                        {new Date(act.createdAt).toLocaleString()} · {act.actor?.name || act.actorName || "System"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Add Member Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Member"
        subtitle="Enter personal information, address details and more"
        maxWidth={780}
      >
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column" }}>
          {renderMemberForm(false)}

          <div
            className="modal-footer"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              paddingTop: 16,
              marginTop: 18,
              borderTop: "1px solid var(--line)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateOpen(false)}
              style={{ padding: "9px 20px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isFormValid || formBusy}
              style={{
                padding: "9px 24px",
                background: isFormValid ? "#059669" : undefined,
                borderColor: isFormValid ? "#059669" : undefined,
                opacity: !isFormValid ? 0.45 : 1,
                cursor: !isFormValid ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {formBusy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Member Details Modal */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Member Details"
        subtitle="Update contact, address and profile info"
        maxWidth={780}
      >
        <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column" }}>
          {renderMemberForm(true)}

          <div
            className="modal-footer"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              paddingTop: 16,
              marginTop: 18,
              borderTop: "1px solid var(--line)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditOpen(false)}
              style={{ padding: "9px 20px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isFormValid || formBusy}
              style={{
                padding: "9px 24px",
                background: isFormValid ? "#059669" : undefined,
                borderColor: isFormValid ? "#059669" : undefined,
                opacity: !isFormValid ? 0.45 : 1,
                cursor: !isFormValid ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {formBusy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Tags Modal */}
      <Modal
        isOpen={tagsModalOpen}
        onClose={() => setTagsModalOpen(false)}
        title="Manage Directory Tags"
        subtitle="Organize directory members with custom labels"
        maxWidth={440}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form onSubmit={handleCreateTag} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="New tag name (e.g. VIP, Batch A)"
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
        title="Import Directory from CSV"
        subtitle="Bulk import members, students or customers"
        maxWidth={560}
      >
        <form onSubmit={handleImportCsv} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            Paste CSV data with headers: <code>displayName, email, phone, type, notes</code>
          </p>
          <textarea
            rows={7}
            placeholder={`displayName,email,phone,type\nAnil Verma,anil@example.com,+919876543210,MEMBER\nPooja Sharma,pooja@example.com,+919876543211,STUDENT`}
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
