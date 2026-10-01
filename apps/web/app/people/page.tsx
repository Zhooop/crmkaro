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
import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import {
  useWorkspace,
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
    planValidityMonths?: string;
  } | null;
  notes: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  types: Array<{ type: PersonType }>;
  tags: Array<{ tagId: string; tag: Tag }>;
  studentProfile?: {
    id: string;
    rollNumber: string | null;
    standard: string | null;
    batch: string | null;
    feeAmountMinor: number;
    feeFrequency: string;
    admissionDate: string;
    status: string;
  } | null;
  payments?: Array<{
    id: string;
    amountMinor: number;
    receivedAt: string;
    method: string;
    status: string;
    invoiceId: string | null;
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    grandTotalMinor: number;
    paidTotalMinor: number;
    balanceDueMinor: number;
    dueDate: string;
    status: string;
    notes?: string | null;
  }>;
  activities?: Array<{
    id: string;
    action: string;
    summary?: string;
    actorName?: string;
    actor?: { name: string | null; email: string };
    createdAt: string;
  }>;
};

export type PersonFeeDetails = {
  hasFeePlan: boolean;
  planMonths: number;
  planLabel: string;
  feeAmountMinor: number;
  latestPayment: {
    id: string;
    amountMinor: number;
    receivedAt: string;
    method: string;
    status: string;
    invoiceId: string | null;
  } | null;
  latestInvoice: {
    id: string;
    invoiceNumber: string;
    grandTotalMinor: number;
    paidTotalMinor: number;
    balanceDueMinor: number;
    dueDate: string;
    status: string;
  } | null;
  feeStatus: "PAID" | "EXPIRING_SOON" | "OVERDUE" | "PARTIALLY_PAID" | "PENDING" | "NO_PLAN";
  statusBadgeLabel: string;
  statusBadgeTone: "green" | "amber" | "red" | "neutral";
  statusBadgeColor: string;
  statusBadgeBg: string;
  statusBadgeBorder: string;
  validUntilDate: Date | null;
  validUntilStr: string | null;
  daysRemaining: number | null;
  paidAmountMinor: number;
  paidDateStr: string | null;
  paidMethod: string | null;
  memberId: string | null;
};

export function getPersonFeeDetails(person: Person): PersonFeeDetails {
  const profile = person.studentProfile;
  const payments = person.payments || [];
  const invoices = person.invoices || [];

  let planMonths = 1;
  const addr = (person.address && typeof person.address === "object" ? person.address : {}) as Record<string, any>;
  if (addr.planValidityMonths) {
    const parsed = parseInt(addr.planValidityMonths, 10);
    if (!isNaN(parsed) && parsed > 0) planMonths = parsed;
  } else if (profile?.feeFrequency === "ANNUAL") {
    planMonths = 12;
  } else if (profile?.feeFrequency === "QUARTERLY") {
    planMonths = 3;
  } else if (person.notes) {
    const m = person.notes.match(/(\d+)\s*(?:month|mahina|mahine)/i);
    if (m && m[1]) {
      const p = parseInt(m[1], 10);
      if (!isNaN(p) && p > 0 && p <= 12) planMonths = p;
    }
  }

  const feeAmountMinor = profile?.feeAmountMinor || invoices[0]?.grandTotalMinor || 0;
  const latestPayment = payments[0] || null;
  const latestInvoice = invoices[0] || null;
  const memberId = profile?.rollNumber || addr.admissionNumber || null;

  const planLabel = planMonths === 1 ? "1 Month Plan" : planMonths === 12 ? "12 Months (1 Year)" : `${planMonths} Months Plan`;

  const now = new Date();
  const nowMs = now.getTime();

  let feeStatus: PersonFeeDetails["feeStatus"] = "NO_PLAN";
  let statusBadgeLabel = "No Active Plan";
  let statusBadgeTone: PersonFeeDetails["statusBadgeTone"] = "neutral";
  let statusBadgeColor = "#64748b";
  let statusBadgeBg = "#f1f5f9";
  let statusBadgeBorder = "#cbd5e1";
  let validUntilDate: Date | null = null;
  let validUntilStr: string | null = null;
  let daysRemaining: number | null = null;
  let paidAmountMinor = 0;
  let paidDateStr: string | null = null;
  let paidMethod: string | null = null;

  if (latestPayment) {
    paidAmountMinor = latestPayment.amountMinor;
    paidDateStr = new Date(latestPayment.receivedAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    paidMethod = latestPayment.method || "CASH";
  } else if (latestInvoice && latestInvoice.paidTotalMinor > 0) {
    paidAmountMinor = latestInvoice.paidTotalMinor;
    paidDateStr = new Date(latestInvoice.dueDate || person.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    paidMethod = "RECORDED";
  }

  const hasPlan = feeAmountMinor > 0 || Boolean(profile) || payments.length > 0 || invoices.length > 0 || Boolean(addr.planValidityMonths);

  if (hasPlan) {
    if (latestInvoice && latestInvoice.paidTotalMinor > 0 && latestInvoice.balanceDueMinor > 0) {
      feeStatus = "PARTIALLY_PAID";
      statusBadgeLabel = `Partially Paid (₹${(latestInvoice.balanceDueMinor / 100).toLocaleString("en-IN")} Due)`;
      statusBadgeTone = "amber";
      statusBadgeColor = "#b45309";
      statusBadgeBg = "#fef3c7";
      statusBadgeBorder = "#fde68a";
    } else if (latestPayment || (latestInvoice && latestInvoice.paidTotalMinor > 0)) {
      const baseDate = latestPayment
        ? new Date(latestPayment.receivedAt)
        : new Date(latestInvoice?.dueDate || person.createdAt);
      
      validUntilDate = new Date(baseDate);
      validUntilDate.setMonth(validUntilDate.getMonth() + planMonths);
      validUntilStr = validUntilDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      
      const diffMs = validUntilDate.getTime() - nowMs;
      daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

      if (daysRemaining > 10) {
        feeStatus = "PAID";
        statusBadgeLabel = `Paid (till ${validUntilStr})`;
        statusBadgeTone = "green";
        statusBadgeColor = "#047857";
        statusBadgeBg = "#d1fae5";
        statusBadgeBorder = "#a7f3d0";
      } else if (daysRemaining >= 0) {
        feeStatus = "EXPIRING_SOON";
        statusBadgeLabel = daysRemaining === 0 ? `Expires Today (${validUntilStr})` : `Upcoming (Expires in ${daysRemaining}d · ${validUntilStr})`;
        statusBadgeTone = "amber";
        statusBadgeColor = "#b45309";
        statusBadgeBg = "#fffbeb";
        statusBadgeBorder = "#fde68a";
      } else {
        feeStatus = "OVERDUE";
        statusBadgeLabel = `Overdue (${Math.abs(daysRemaining)}d ago · ${validUntilStr})`;
        statusBadgeTone = "red";
        statusBadgeColor = "#dc2626";
        statusBadgeBg = "#fef2f2";
        statusBadgeBorder = "#fecaca";
      }
    } else {
      feeStatus = "PENDING";
      const dueAmount = latestInvoice ? latestInvoice.balanceDueMinor : feeAmountMinor;
      statusBadgeLabel = dueAmount > 0 ? `Unpaid (₹${(dueAmount / 100).toLocaleString("en-IN")} Due)` : "Fee Unpaid";
      statusBadgeTone = "red";
      statusBadgeColor = "#dc2626";
      statusBadgeBg = "#fef2f2";
      statusBadgeBorder = "#fecaca";
    }
  }

  return {
    hasFeePlan: hasPlan,
    planMonths,
    planLabel,
    feeAmountMinor,
    latestPayment,
    latestInvoice,
    feeStatus,
    statusBadgeLabel,
    statusBadgeTone,
    statusBadgeColor,
    statusBadgeBg,
    statusBadgeBorder,
    validUntilDate,
    validUntilStr,
    daysRemaining,
    paidAmountMinor,
    paidDateStr,
    paidMethod,
    memberId,
  };
}

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
  const [feeFilter, setFeeFilter] = useState<"ALL" | "PENDING" | "PAID" | "UPCOMING">("ALL");
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  // Memoized fee counts for filter buttons
  const feeCounts = useMemo(() => {
    let pending = 0;
    let paid = 0;
    let upcoming = 0;

    for (const p of people) {
      const details = getPersonFeeDetails(p);
      if (!details.hasFeePlan) continue;
      if (details.feeStatus === "PAID") {
        paid++;
      } else if (details.feeStatus === "EXPIRING_SOON") {
        upcoming++;
      } else if (
        details.feeStatus === "PENDING" ||
        details.feeStatus === "OVERDUE" ||
        details.feeStatus === "PARTIALLY_PAID"
      ) {
        pending++;
      }
    }

    return {
      total: people.length,
      pending,
      paid,
      upcoming,
    };
  }, [people]);

  // Filtered people based on active fee filter
  const displayedPeople = useMemo(() => {
    if (feeFilter === "ALL") return people;
    return people.filter((p) => {
      const details = getPersonFeeDetails(p);
      if (feeFilter === "PAID") return details.feeStatus === "PAID";
      if (feeFilter === "UPCOMING") return details.feeStatus === "EXPIRING_SOON";
      if (feeFilter === "PENDING") {
        return (
          details.feeStatus === "PENDING" ||
          details.feeStatus === "OVERDUE" ||
          details.feeStatus === "PARTIALLY_PAID"
        );
      }
      return true;
    });
  }, [people, feeFilter]);

  const { orgName, userName, userRole, organisations, navItems, updateWorkspace } = useWorkspace();

  // Modals & Drawers
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
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
  const [archiveCandidate, setArchiveCandidate] = useState<Person | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [unarchiveCandidate, setUnarchiveCandidate] = useState<Person | null>(null);
  const [unarchiveBusy, setUnarchiveBusy] = useState(false);

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
  const isNameValid = formName.trim().length >= 2;
  const isPhoneValid = !formPhone.trim() || formPhone.trim().length >= 5;
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
          const srvs = activeOrgEntry.activeServices || activeOrgEntry.organisation.activeServices;
          updateWorkspace({
            orgName: activeOrgEntry.organisation.name,
            userRole: activeOrgEntry.role?.name || "Member",
            ...(Array.isArray(srvs) && srvs.length > 0 ? { activeServices: srvs } : {}),
          });
        }
      }
    } catch {
      // ignore
    }
  }, [api, router, updateWorkspace]);

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
    setEditingPerson(person);
    setDetailPerson(person);
    setModalActiveTab("personal");
    setFormName(person.displayName || "");
    setFormNameTouched(false);
    setFormError("");

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

    const firstType = person.types?.[0]?.type;
    setFormTypes(firstType ? [firstType] : ["MEMBER"]);
    setFormSelectedTags(person.tags?.map((t) => t.tagId) || []);
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
    const target = editingPerson || detailPerson;
    if (!target) {
      setFormError("No member selected for editing.");
      return;
    }
    if (!isNameValid || !isPhoneValid) {
      setFormNameTouched(true);
      setFormError("Please provide a valid member name (at least 2 characters) and primary phone number.");
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

      const res = await authFetch(`${api}/people/${target.id}`, {
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
      const updatedPerson = data.person || data;
      setEditOpen(false);
      setDetailPerson(updatedPerson);
      setEditingPerson(null);
      await loadPeople();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormBusy(false);
    }
  }

  async function confirmArchive() {
    if (!archiveCandidate) return;
    setArchiveBusy(true);
    try {
      const res = await authFetch(`${api}/people/${archiveCandidate.id}/archive`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        if (detailPerson?.id === archiveCandidate.id) setDetailPerson(null);
        setArchiveCandidate(null);
        loadPeople();
      }
    } catch {
      // ignore
    } finally {
      setArchiveBusy(false);
    }
  }

  async function confirmUnarchive() {
    if (!unarchiveCandidate) return;
    setUnarchiveBusy(true);
    try {
      const res = await authFetch(`${api}/people/${unarchiveCandidate.id}/unarchive`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        if (detailPerson?.id === unarchiveCandidate.id) {
          setDetailPerson((prev) => (prev ? { ...prev, status: "ACTIVE" } : null));
        }
        setUnarchiveCandidate(null);
        loadPeople();
      }
    } catch {
      // ignore
    } finally {
      setUnarchiveBusy(false);
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
    { id: "STUDENT", label: "Students / Learners" },
    { id: "CUSTOMER", label: "Customers / Clients" },
    { id: "EMPLOYEE", label: "Employees / Staff" },
    { id: "ARCHIVED", label: "Archived" },
  ];

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

        {/* Student Admission Guidance Banner */}
        <div
          style={{
            padding: "10px 14px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            fontSize: 12.5,
            color: "#1e40af",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <strong>Enrolling a Student or Member with Fees & Plan?</strong>
            <p style={{ margin: "2px 0 0", color: "#3b82f6", fontSize: 11.5 }}>
              Use the dedicated Admissions & Packages portal to configure monthly/term fee plans, batch rosters & admission dates.
            </p>
          </div>
          <a
            href="/students?action=new-admission"
            style={{
              padding: "5px 12px",
              background: "#2563eb",
              color: "#ffffff",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 11.5,
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            + Go to Admissions
          </a>
        </div>

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

  const renderModalFooter = (isEdit: boolean, onClose: () => void) => {
    if (isEdit) {
      return (
        <div
          className="modal-footer modal-sticky-footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 16,
            marginTop: 18,
            borderTop: "1px solid var(--line)",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: "9px 20px" }}
          >
            Cancel
          </button>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {modalActiveTab === "personal" && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFormNameTouched(true);
                  if (isFormValid) setModalActiveTab("address");
                }}
                style={{ padding: "9px 16px", fontWeight: 600 }}
              >
                <span>Address Details →</span>
              </button>
            )}

            {modalActiveTab === "address" && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalActiveTab("personal")}
                  style={{ padding: "9px 14px" }}
                >
                  <span>← Back</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalActiveTab("more")}
                  style={{ padding: "9px 16px", fontWeight: 600 }}
                >
                  <span>More Info →</span>
                </button>
              </>
            )}

            {modalActiveTab === "more" && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalActiveTab("address")}
                style={{ padding: "9px 14px" }}
              >
                <span>← Back</span>
              </button>
            )}

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
              {formBusy ? "Saving Changes…" : "Save Changes"}
            </button>
          </div>
        </div>
      );
    }

    if (modalActiveTab === "personal") {
      return (
        <div
          className="modal-footer modal-sticky-footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 16,
            marginTop: 18,
            borderTop: "1px solid var(--line)",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: "9px 20px" }}
          >
            Cancel
          </button>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={!isFormValid || formBusy}
              style={{ padding: "9px 18px", fontWeight: 600 }}
              title="Save with personal details entered so far"
            >
              {formBusy ? "Saving…" : "Save Member Now"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFormNameTouched(true);
                if (isFormValid) {
                  setModalActiveTab("address");
                }
              }}
              style={{
                padding: "9px 22px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Next: Address Details</span>
              <span>→</span>
            </button>
          </div>
        </div>
      );
    }

    if (modalActiveTab === "address") {
      return (
        <div
          className="modal-footer modal-sticky-footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 16,
            marginTop: 18,
            borderTop: "1px solid var(--line)",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setModalActiveTab("personal")}
            style={{ padding: "9px 20px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={!isFormValid || formBusy}
              style={{ padding: "9px 18px", fontWeight: 600 }}
              title="Save with personal and address details"
            >
              {formBusy ? "Saving…" : "Save Member Now"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModalActiveTab("more")}
              style={{
                padding: "9px 22px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Next: More Info</span>
              <span>→</span>
            </button>
          </div>
        </div>
      );
    }

    // Tab 3: "more"
    return (
      <div
        className="modal-footer modal-sticky-footer"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 16,
          marginTop: 18,
          borderTop: "1px solid var(--line)",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setModalActiveTab("address")}
          style={{ padding: "9px 20px", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span>←</span>
          <span>Back</span>
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!isFormValid || formBusy}
          style={{
            padding: "9px 26px",
            background: isFormValid ? "#059669" : undefined,
            borderColor: isFormValid ? "#059669" : undefined,
            opacity: !isFormValid ? 0.45 : 1,
            cursor: !isFormValid ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {formBusy ? "Saving…" : "Save Member"}
        </button>
      </div>
    );
  };

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/people"
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
          {activeTab !== "ARCHIVED" && (
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
          )}
        </div>
      </div>

      <Tabs items={tabItems} active={activeTab} onChange={setActiveTab} />

      {/* 🏷️ Quick Fee & Plan Filters Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "12px 0 10px 0",
          flexWrap: "wrap",
          padding: "8px 12px",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "var(--muted, #64748b)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginRight: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Icon name="finance" size={13} /> Fee Filter:
        </span>

        <button
          type="button"
          onClick={() => setFeeFilter("ALL")}
          style={{
            padding: "5px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: feeFilter === "ALL" ? 750 : 600,
            cursor: "pointer",
            border: feeFilter === "ALL" ? "1.5px solid #2563eb" : "1px solid #cbd5e1",
            background: feeFilter === "ALL" ? "#eff6ff" : "#ffffff",
            color: feeFilter === "ALL" ? "#1d4ed8" : "#334155",
            transition: "all 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>All Records</span>
          <span
            style={{
              background: feeFilter === "ALL" ? "#2563eb" : "#e2e8f0",
              color: feeFilter === "ALL" ? "#ffffff" : "#475569",
              padding: "1px 6px",
              borderRadius: 10,
              fontSize: 10.5,
              fontWeight: 750,
            }}
          >
            {feeCounts.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFeeFilter("PENDING")}
          style={{
            padding: "5px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: feeFilter === "PENDING" ? 750 : 600,
            cursor: "pointer",
            border: feeFilter === "PENDING" ? "1.5px solid #dc2626" : "1px solid #fecaca",
            background: feeFilter === "PENDING" ? "#fef2f2" : "#ffffff",
            color: feeFilter === "PENDING" ? "#991b1b" : "#b91c1c",
            transition: "all 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>🔴 Pending Fees</span>
          <span
            style={{
              background: feeFilter === "PENDING" ? "#dc2626" : "#fee2e2",
              color: feeFilter === "PENDING" ? "#ffffff" : "#991b1b",
              padding: "1px 6px",
              borderRadius: 10,
              fontSize: 10.5,
              fontWeight: 750,
            }}
          >
            {feeCounts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFeeFilter("PAID")}
          style={{
            padding: "5px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: feeFilter === "PAID" ? 750 : 600,
            cursor: "pointer",
            border: feeFilter === "PAID" ? "1.5px solid #059669" : "1px solid #a7f3d0",
            background: feeFilter === "PAID" ? "#ecfdf5" : "#ffffff",
            color: feeFilter === "PAID" ? "#065f46" : "#047857",
            transition: "all 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>🟢 Paid Fees</span>
          <span
            style={{
              background: feeFilter === "PAID" ? "#059669" : "#d1fae5",
              color: feeFilter === "PAID" ? "#ffffff" : "#065f46",
              padding: "1px 6px",
              borderRadius: 10,
              fontSize: 10.5,
              fontWeight: 750,
            }}
          >
            {feeCounts.paid}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFeeFilter("UPCOMING")}
          style={{
            padding: "5px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: feeFilter === "UPCOMING" ? 750 : 600,
            cursor: "pointer",
            border: feeFilter === "UPCOMING" ? "1.5px solid #d97706" : "1px solid #fde68a",
            background: feeFilter === "UPCOMING" ? "#fffbeb" : "#ffffff",
            color: feeFilter === "UPCOMING" ? "#92400e" : "#b45309",
            transition: "all 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>🟡 Upcoming Fees (10-Day Window)</span>
          <span
            style={{
              background: feeFilter === "UPCOMING" ? "#d97706" : "#fef3c7",
              color: feeFilter === "UPCOMING" ? "#ffffff" : "#92400e",
              padding: "1px 6px",
              borderRadius: 10,
              fontSize: 10.5,
              fontWeight: 750,
            }}
          >
            {feeCounts.upcoming}
          </span>
        </button>

        {feeFilter !== "ALL" && (
          <button
            type="button"
            className="btn-icon"
            onClick={() => setFeeFilter("ALL")}
            title="Reset fee filter"
            style={{ fontSize: 11, color: "var(--muted)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}
          >
            Clear Filter
          </button>
        )}
      </div>

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
          title={activeTab === "ARCHIVED" ? "No archived records" : "No member records found"}
          description={
            activeTab === "ARCHIVED"
              ? "Archived members and inactive contacts will appear here."
              : search || selectedTag || activeTab !== "ALL"
                ? "Try adjusting your search or active filters."
                : "Start by adding your first member, student, or customer to your directory."
          }
          actionLabel={activeTab === "ARCHIVED" ? undefined : "Add Member"}
          onAction={
            activeTab === "ARCHIVED"
              ? undefined
              : () => {
                  resetForm();
                  setCreateOpen(true);
                }
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Person / Member</th>
                <th>Contact</th>
                <th>Fee Plan & Validity</th>
                <th>Payment & Status</th>
                <th>Category</th>
                <th>Location</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedPeople.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "36px 16px", color: "var(--muted)" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                      No members match "{feeFilter === "PENDING" ? "Pending Fees" : feeFilter === "PAID" ? "Paid Fees" : "Upcoming Fees"}"
                    </div>
                    <p style={{ margin: "0 0 12px 0", fontSize: 12.5 }}>
                      Try selecting "All Records" or changing the directory tab above.
                    </p>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setFeeFilter("ALL")}
                      type="button"
                    >
                      Reset Fee Filter
                    </button>
                  </td>
                </tr>
              ) : (
                displayedPeople.map((person) => {
                  const feeDetails = getPersonFeeDetails(person);
                  return (
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
                            {feeDetails.memberId && (
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 10,
                                  fontWeight: 750,
                                  color: "#2563eb",
                                  background: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  marginTop: 2,
                                  marginRight: 4,
                                }}
                              >
                                {feeDetails.memberId}
                              </span>
                            )}
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
                        {feeDetails.hasFeePlan ? (
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
                              <span>⏱️ {feeDetails.planLabel}</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>
                              {feeDetails.feeAmountMinor > 0 ? (
                                <span style={{ fontWeight: 700, color: "#1e293b" }}>
                                  ₹{(feeDetails.feeAmountMinor / 100).toLocaleString("en-IN")} Plan Fee
                                </span>
                              ) : (
                                <span style={{ color: "var(--muted)" }}>Configured Plan</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>No plan</span>
                        )}
                      </td>
                      <td>
                        {feeDetails.hasFeePlan ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div>
                              <span
                                style={{
                                  background: feeDetails.statusBadgeBg,
                                  color: feeDetails.statusBadgeColor,
                                  border: `1px solid ${feeDetails.statusBadgeBorder}`,
                                  padding: "2px 8px",
                                  borderRadius: 5,
                                  fontSize: 11,
                                  fontWeight: 750,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                {feeDetails.statusBadgeLabel}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.35 }}>
                              {feeDetails.paidAmountMinor > 0 ? (
                                <div>
                                  <strong style={{ color: "#047857" }}>
                                    Paid ₹{(feeDetails.paidAmountMinor / 100).toLocaleString("en-IN")}
                                  </strong>
                                  {feeDetails.paidDateStr && <span> on {feeDetails.paidDateStr}</span>}
                                  {feeDetails.paidMethod && (
                                    <span style={{ textTransform: "uppercase", fontSize: 10, color: "#475569", marginLeft: 4 }}>
                                      ({feeDetails.paidMethod})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: "#dc2626", fontWeight: 650 }}>No payment recorded</span>
                              )}
                              {feeDetails.validUntilStr && (
                                <div style={{ fontSize: 10.5, color: "#64748b" }}>
                                  Expires: <strong>{feeDetails.validUntilStr}</strong>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                        )}
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
                          <span style={{ fontSize: 12, color: "var(--ink)" }}>
                            {[person.address.city, person.address.state].filter(Boolean).join(", ")}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
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
                          {person.status === "ACTIVE" ? (
                            <button
                              className="btn-icon"
                              title="Archive"
                              onClick={() => setArchiveCandidate(person)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          ) : (
                            <button
                              className="btn-icon"
                              title="Restore / Unarchive"
                              onClick={() => setUnarchiveCandidate(person)}
                              style={{ color: "#059669" }}
                            >
                              <Icon name="refresh" size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
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

            {/* 🌟 Membership Fee & Payment Details Card */}
            {(() => {
              const feeInfo = getPersonFeeDetails(detailPerson);
              return (
                <div
                  style={{
                    background:
                      feeInfo.feeStatus === "PAID"
                        ? "#f0fdf4"
                        : feeInfo.feeStatus === "EXPIRING_SOON"
                        ? "#fffbeb"
                        : feeInfo.feeStatus === "OVERDUE" || feeInfo.feeStatus === "PENDING"
                        ? "#fef2f2"
                        : "#f8fafc",
                    border: `1px solid ${feeInfo.statusBadgeBorder}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 16 }}>💳</span>
                      <strong style={{ fontSize: 13.5, color: "var(--ink)" }}>Fee Plan & Payment Details</strong>
                    </div>
                    <span
                      style={{
                        background: feeInfo.statusBadgeBg,
                        color: feeInfo.statusBadgeColor,
                        border: `1px solid ${feeInfo.statusBadgeBorder}`,
                        padding: "3px 9px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 750,
                      }}
                    >
                      {feeInfo.statusBadgeLabel}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5 }}>
                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Plan Validity (Months)</small>
                      <strong style={{ color: "var(--ink)", fontSize: 13 }}>⏱️ {feeInfo.planLabel}</strong>
                      {feeInfo.feeAmountMinor > 0 && (
                        <div style={{ color: "#475569", fontSize: 11, marginTop: 1 }}>
                          ₹{(feeInfo.feeAmountMinor / 100).toLocaleString("en-IN")} Plan Fee
                        </div>
                      )}
                    </div>

                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Valid Until / Expiry</small>
                      <strong style={{ color: feeInfo.feeStatus === "OVERDUE" ? "#dc2626" : "var(--ink)", fontSize: 13 }}>
                        {feeInfo.validUntilStr || "—"}
                      </strong>
                      {feeInfo.daysRemaining !== null && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 650,
                            marginTop: 1,
                            color:
                              feeInfo.daysRemaining < 0
                                ? "#dc2626"
                                : feeInfo.daysRemaining <= 10
                                ? "#d97706"
                                : "#059669",
                          }}
                        >
                          {feeInfo.daysRemaining < 0
                            ? `${Math.abs(feeInfo.daysRemaining)} days overdue`
                            : feeInfo.daysRemaining === 0
                            ? "Expires today"
                            : `${feeInfo.daysRemaining} days remaining`}
                        </div>
                      )}
                    </div>

                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Amount Paid (Last Payment)</small>
                      <strong style={{ color: feeInfo.paidAmountMinor > 0 ? "#047857" : "#dc2626", fontSize: 13 }}>
                        {feeInfo.paidAmountMinor > 0
                          ? `₹${(feeInfo.paidAmountMinor / 100).toLocaleString("en-IN")}`
                          : "No payment recorded"}
                      </strong>
                    </div>

                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Payment Date & Method</small>
                      <strong style={{ color: "var(--ink)", fontSize: 13 }}>
                        {feeInfo.paidDateStr ? `${feeInfo.paidDateStr} (${feeInfo.paidMethod || "CASH"})` : "—"}
                      </strong>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${feeInfo.statusBadgeBorder}`, display: "flex", gap: 8 }}>
                    <a
                      href={`/quick-collect?personId=${detailPerson.id}&amount=${feeInfo.feeAmountMinor > 0 ? feeInfo.feeAmountMinor / 100 : ""}`}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, justifyContent: "center", textDecoration: "none", fontSize: 12, fontWeight: 700 }}
                    >
                      ⚡ Collect Fee / Renew
                    </a>
                    <a
                      href={`/finance?action=new-invoice&personId=${detailPerson.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, justifyContent: "center", textDecoration: "none", fontSize: 12, fontWeight: 650 }}
                    >
                      📄 New Invoice
                    </a>
                  </div>
                </div>
              );
            })()}
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
                <a
                  href={`/students?action=new-admission`}
                  className="btn btn-secondary btn-sm"
                  style={{ color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff" }}
                >
                  <Icon name="student" size={14} />
                  <span>Admit as Student</span>
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
                {detailPerson.status === "ARCHIVED" ? (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ background: "#059669", borderColor: "#059669" }}
                    onClick={() => setUnarchiveCandidate(detailPerson)}
                  >
                    <Icon name="refresh" size={14} />
                    <span>Restore Member</span>
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ color: "#b91c1c" }}
                    onClick={() => setArchiveCandidate(detailPerson)}
                  >
                    <Icon name="trash" size={14} />
                    <span>Archive</span>
                  </button>
                )}
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
          {renderModalFooter(false, () => setCreateOpen(false))}
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
          {renderModalFooter(true, () => setEditOpen(false))}
        </form>
      </Modal>

      {/* Custom Archive / Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(archiveCandidate)}
        onClose={() => {
          if (!archiveBusy) setArchiveCandidate(null);
        }}
        title="Archive Member"
        subtitle="Move member profile to archive"
        maxWidth={480}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              padding: "16px",
              background: "#fff1f2",
              borderRadius: 10,
              border: "1px solid #fecdd3",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "#fee2e2",
                color: "#e11d48",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="trash" size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#9f1239" }}>
                Archive &quot;{archiveCandidate?.displayName}&quot;?
              </div>
              <div style={{ fontSize: 12.5, color: "#4c0519", marginTop: 4, lineHeight: 1.5 }}>
                This member will be moved to the <strong>Archived</strong> tab. Their past payments, batch histories, and invoices will remain completely safe and preserved.
              </div>
            </div>
          </div>

          <div
            className="modal-footer"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              paddingTop: 12,
              marginTop: 4,
              borderTop: "1px solid var(--line)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setArchiveCandidate(null)}
              disabled={archiveBusy}
              style={{ padding: "8px 18px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={archiveBusy}
              onClick={confirmArchive}
              style={{
                padding: "8px 22px",
                background: "#e11d48",
                color: "#ffffff",
                fontWeight: 700,
                border: "none",
                borderRadius: 8,
                cursor: archiveBusy ? "not-allowed" : "pointer",
              }}
            >
              {archiveBusy ? "Archiving…" : "Yes, Archive"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Custom Unarchive / Restore Confirmation Modal */}
      <Modal
        isOpen={Boolean(unarchiveCandidate)}
        onClose={() => {
          if (!unarchiveBusy) setUnarchiveCandidate(null);
        }}
        title="Restore Member"
        subtitle="Move member back to active directory"
        maxWidth={480}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              padding: "16px",
              background: "#ecfdf5",
              borderRadius: 10,
              border: "1px solid #a7f3d0",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "#d1fae5",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="refresh" size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#065f46" }}>
                Restore &quot;{unarchiveCandidate?.displayName}&quot;?
              </div>
              <div style={{ fontSize: 12.5, color: "#064e3b", marginTop: 4, lineHeight: 1.5 }}>
                This member will be reactivated and moved back to the <strong>All Directory</strong> active list.
              </div>
            </div>
          </div>

          <div
            className="modal-footer"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              paddingTop: 12,
              marginTop: 4,
              borderTop: "1px solid var(--line)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setUnarchiveCandidate(null)}
              disabled={unarchiveBusy}
              style={{ padding: "8px 18px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={unarchiveBusy}
              onClick={confirmUnarchive}
              style={{
                padding: "8px 22px",
                background: "#059669",
                color: "#ffffff",
                fontWeight: 700,
                border: "none",
                borderRadius: 8,
                cursor: unarchiveBusy ? "not-allowed" : "pointer",
              }}
            >
              {unarchiveBusy ? "Restoring…" : "Yes, Restore"}
            </button>
          </div>
        </div>
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
