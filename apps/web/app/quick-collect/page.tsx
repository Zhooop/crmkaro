"use client";

import {
  AppShell,
  Badge,
  Icon,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";
import {
  buildNavItems,
  useWorkspaceContext,
  DEFAULT_SERVICE_CODES,
  saveActiveServicesToStorage,
} from "@/lib/nav";

type PersonOption = {
  id: string;
  displayName: string;
  primaryPhone: string | null;
  email: string | null;
};

type GeneratedPayerLink = {
  personId: string;
  name: string;
  phone: string | null;
  amountMinor: number;
  notes: string;
  invoiceNumber?: string;
  invoiceId?: string;
};

function QuickCollectContent() {
  const router = useRouter();
  const api = getApiUrl();

  // AppShell States
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

  // Form States
  const [feeAmount, setFeeAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [doNotSendDirect, setDoNotSendDirect] = useState(false);

  // Payer Selection States
  const [activePayerTab, setActivePayerTab] = useState<"list" | "import" | "manual">("list");
  const [allPeople, setAllPeople] = useState<PersonOption[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());

  // Manual Member Inputs
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // Submission / Success States
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successList, setSuccessList] = useState<GeneratedPayerLink[] | null>(null);

  // Copy Feedback State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  function copyPayLink(key: string, url: string) {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    showToast("Payment link copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2200);
  }

  function copyAllLinks() {
    if (!successList || successList.length === 0) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = successList
      .map((item) => {
        const link = item.invoiceId ? `${origin}/pay/${item.invoiceId}` : "";
        return `${item.name}${item.phone ? ` (${item.phone})` : ""}: ₹${(item.amountMinor / 100).toLocaleString("en-IN")}\nLink: ${link}`;
      })
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedKey("all");
    showToast("All payment links copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2200);
  }

  // Load Session Context
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

  // Load Members List
  const loadPeople = useCallback(async () => {
    setPeopleLoading(true);
    try {
      const res = await authFetch(`${api}/people?limit=300`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAllPeople(
          (data.items || []).map((p: any) => ({
            id: p.id,
            displayName: p.displayName || p.name || [p.firstName, p.lastName].filter(Boolean).join(" ") || "Member",
            primaryPhone: p.primaryPhone || p.phone || null,
            email: p.email || null,
          })),
        );
      }
    } catch {
      // ignore
    } finally {
      setPeopleLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadContext();
    loadPeople();
  }, [loadContext, loadPeople]);

  function handleClear() {
    setFeeAmount("");
    setNotes("");
    setDoNotSendDirect(false);
    setSelectedPersonIds(new Set());
    setErrorMessage("");
    setSuccessList(null);
    setMemberSearch("");
    setManualName("");
    setManualPhone("");
  }

  function toggleSelectPerson(id: string) {
    setSelectedPersonIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered(filtered: PersonOption[]) {
    setSelectedPersonIds((curr) => {
      const next = new Set(curr);
      const allSelected = filtered.every((p) => next.has(p.id));
      if (allSelected) {
        filtered.forEach((p) => next.delete(p.id));
      } else {
        filtered.forEach((p) => next.add(p.id));
      }
      return next;
    });
  }

  async function handleAddManualPayer(e: FormEvent) {
    e.preventDefault();
    if (!manualName.trim()) return;
    try {
      const res = await authFetch(`${api}/people`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: manualName.trim(),
          primaryPhone: manualPhone.trim() || undefined,
          types: ["CUSTOMER"],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const p = data.person || data;
        if (p && p.id) {
          const newP: PersonOption = {
            id: p.id,
            displayName: p.displayName || manualName.trim(),
            primaryPhone: p.primaryPhone || manualPhone.trim() || null,
            email: p.email || null,
          };
          setAllPeople((prev) => [newP, ...prev.filter((item) => item.id !== p.id)]);
          setSelectedPersonIds((prev) => new Set(prev).add(p.id));
          setManualName("");
          setManualPhone("");
          setActivePayerTab("list");
          showToast("Payer added and selected");
        }
      }
    } catch {
      // ignore
    }
  }

  async function handleSendQuickCollect(e?: FormEvent) {
    if (e) e.preventDefault();
    const parsedAmount = Number(feeAmount);
    if (!parsedAmount || parsedAmount < 2 || parsedAmount > 200000) {
      setErrorMessage("Please enter a valid amount between ₹2 and ₹2,00,000.");
      return;
    }
    if (selectedPersonIds.size === 0) {
      setErrorMessage("Please select at least 1 payer from the list below.");
      return;
    }

    const feeNotes = notes.trim() || "Quick Collect Fee";
    setSubmitting(true);
    setErrorMessage("");

    const generated: GeneratedPayerLink[] = [];

    try {
      const selectedList = allPeople.filter((p) => p && p.id && selectedPersonIds.has(p.id));
      const amountMinor = Math.round(parsedAmount * 100);
      const today = new Date().toISOString();

      for (const person of selectedList) {
        try {
          const invRes = await authFetch(`${api}/finance/invoices`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              personId: person.id,
              issueDate: today,
              dueDate: today,
              currency: "INR",
              notes: feeNotes,
              items: [
                {
                  description: feeNotes,
                  quantity: 1,
                  unitPriceMinor: amountMinor,
                  taxRateBps: 0,
                },
              ],
            }),
          });

          let invoiceNumber = "";
          let invoiceId = "";
          if (invRes.ok) {
            const invData = await invRes.json();
            invoiceNumber = invData.invoiceNumber || "";
            invoiceId = invData.id || "";
            if (invData.id) {
              await authFetch(`${api}/finance/invoices/${invData.id}/issue`, {
                method: "POST",
                credentials: "include",
              }).catch(() => {});
            }
          }

          generated.push({
            personId: person.id,
            name: person.displayName || "Member",
            phone: person.primaryPhone,
            amountMinor,
            notes: feeNotes,
            invoiceNumber,
            invoiceId,
          });
        } catch {
          // ignore single fail
        }
      }

      setSuccessList(generated);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const searchLower = (memberSearch || "").trim().toLowerCase();
  const filteredPeople = allPeople.filter((p) => {
    if (!p) return false;
    const name = (p.displayName || "").toLowerCase();
    const phone = p.primaryPhone || "";
    return name.includes(searchLower) || (Boolean(memberSearch) && phone.includes(memberSearch));
  });

  const numAmount = Number(feeAmount) || 0;
  const navItems: NavItem[] = isMounted ? buildNavItems(activeServiceCodes) : defaultNav;

  return (
    <AppShell
      product="CRMKaro"
      organisation={isMounted ? orgName : "CRMKaro Workspace"}
      organisations={organisations}
      currentPath="/quick-collect"
      nav={navItems}
      userName={isMounted ? userName : "Workspace User"}
      userRole={isMounted ? userRole : "Owner"}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
      onPrefetch={(href) => router.prefetch(href)}
    >
      <div style={{ maxWidth: 940, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 4,
            borderBottom: "1px solid var(--line, #e2e8f0)",
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#059669", marginBottom: 2 }}>
              Payment Requests
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--ink, #0f172a)" }}>
              Quick Collect
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted, #64748b)", margin: "3px 0 0" }}>
              Generate instant Razorpay online payment links and share via WhatsApp.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={submitting}
              style={{ padding: "8px 16px", fontSize: 13, fontWeight: 650 }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSendQuickCollect()}
              disabled={submitting}
              style={{
                background: "#059669",
                borderColor: "#059669",
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="zap" size={14} />
              <span>{submitting ? "Generating…" : `Generate Links (${selectedPersonIds.size})`}</span>
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div
            style={{
              padding: "12px 16px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              style={{ background: "transparent", border: "none", color: "#991b1b", cursor: "pointer", padding: 0 }}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        {/* SUCCESS SUMMARY CARD */}
        {successList && (
          <div
            style={{
              background: "#ffffff",
              border: "1.5px solid #10b981",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.12)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#d1fae5",
                      color: "#059669",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="check" size={14} />
                  </div>
                  <h3 style={{ color: "#065f46", fontSize: 16, fontWeight: 750, margin: 0 }}>
                    {successList.length} Payment Link{successList.length === 1 ? "" : "s"} Ready
                  </h3>
                </div>
                <p style={{ color: "#047857", fontSize: 13, margin: 0 }}>
                  Invoices are recorded. You can copy links directly or share via WhatsApp below.
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={copyAllLinks}
                  style={{
                    background: "#ecfdf5",
                    borderColor: "#a7f3d0",
                    color: "#065f46",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon name={copiedKey === "all" ? "check" : "copy"} size={13} />
                  <span>{copiedKey === "all" ? "Copied All" : "Copy All Links"}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push("/transactions")}
                  style={{
                    background: "#ffffff",
                    borderColor: "#cbd5e1",
                    color: "var(--ink, #0f172a)",
                    fontSize: 12,
                    fontWeight: 650,
                  }}
                >
                  View Transactions
                </button>
              </div>
            </div>

            {/* Generated Links Table */}
            <div className="table-wrap" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "10px 14px" }}>Payer</th>
                    <th style={{ padding: "10px 14px" }}>Amount</th>
                    <th style={{ padding: "10px 14px" }}>Invoice Ref</th>
                    <th style={{ padding: "10px 14px" }}>Payment Link</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {successList.map((item, idx) => {
                    const amountFormatted = `₹ ${(item.amountMinor / 100).toLocaleString("en-IN")}`;
                    const payUrl = item.invoiceId && typeof window !== "undefined"
                      ? `${window.location.origin}/pay/${item.invoiceId}`
                      : "";
                    const whatsappMsg = `Dear ${item.name},\nYour fee payment of ${amountFormatted} for "${item.notes}" is requested. Reference: ${item.invoiceNumber || "INV"}.\n\nPay online via UPI, Cards, or NetBanking:\n${payUrl}\n\nThank you,\n${orgName}`;
                    const whatsappUrl = item.phone
                      ? `https://wa.me/${item.phone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMsg)}`
                      : null;
                    const itemKey = item.invoiceId || String(idx);
                    const isCopied = copiedKey === itemKey;

                    return (
                      <tr key={itemKey}>
                        <td style={{ padding: "10px 14px" }}>
                          <strong style={{ fontSize: 13, color: "var(--ink)" }}>{item.name}</strong>
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{item.phone || "No phone number"}</div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <strong style={{ color: "#059669", fontSize: 13.5 }}>{amountFormatted}</strong>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <Badge tone="blue">{item.invoiceNumber || "Recorded"}</Badge>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {payUrl ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="text"
                                readOnly
                                value={payUrl}
                                style={{
                                  fontSize: 11.5,
                                  color: "#334155",
                                  background: "#f8fafc",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 6,
                                  padding: "4px 8px",
                                  width: 170,
                                  outline: "none",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => copyPayLink(itemKey, payUrl)}
                                title="Copy checkout link"
                                style={{
                                  border: "1px solid",
                                  borderColor: isCopied ? "#86efac" : "#cbd5e1",
                                  background: isCopied ? "#f0fdf4" : "#ffffff",
                                  color: isCopied ? "#15803d" : "var(--ink)",
                                  borderRadius: 6,
                                  padding: "5px 9px",
                                  fontSize: 11.5,
                                  fontWeight: 650,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Icon name={isCopied ? "check" : "copy"} size={12} />
                                <span>{isCopied ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>Generating…</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                            {payUrl && (
                              <a
                                href={payUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 650,
                                  color: "#2563eb",
                                  borderColor: "#bfdbfe",
                                  background: "#eff6ff",
                                  padding: "5px 10px",
                                }}
                                title="Open payment gateway"
                              >
                                <span>Open</span>
                              </a>
                            )}
                            {whatsappUrl ? (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{
                                  background: "#16a34a",
                                  color: "#ffffff",
                                  borderColor: "#16a34a",
                                  fontWeight: 700,
                                  fontSize: 12,
                                  padding: "5px 11px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                }}
                              >
                                <Icon name="whatsapp" size={13} />
                                <span>WhatsApp</span>
                              </a>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--muted)" }}>No Phone</span>
                            )}
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

        {/* CARD 1: ENTER AMOUNT */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 12,
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 750, color: "var(--ink, #0f172a)", margin: 0 }}>
              Payment Details
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--muted, #64748b)", margin: "3px 0 0" }}>
              Specify the fee amount and description for each selected payer.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
            {/* Fee Amount */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5, color: "var(--ink)" }}>
                Amount (INR) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid var(--line, #cbd5e1)",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#ffffff",
                }}
              >
                <span style={{ padding: "8px 12px", background: "#f8fafc", borderRight: "1px solid #cbd5e1", fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>
                  ₹
                </span>
                <input
                  type="number"
                  min={2}
                  max={200000}
                  placeholder="e.g. 1500"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  style={{ border: "none", outline: "none", padding: "8px 12px", width: "100%", fontSize: 13.5, fontWeight: 600 }}
                />
              </div>
              <small style={{ color: "var(--muted)", fontSize: 11, display: "block", marginTop: 4 }}>
                Allowed amount between ₹2 and ₹2,00,000
              </small>
            </div>

            {/* Notes */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5, color: "var(--ink)" }}>
                Fee Description / Purpose
              </label>
              <input
                type="text"
                placeholder="e.g. Monthly Tuition Fee / Registration"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line, #cbd5e1)", fontSize: 13 }}
              />
              <small style={{ color: "var(--muted)", fontSize: 11, display: "block", marginTop: 4 }}>
                Defaults to &quot;Quick Collect Fee&quot; if left empty
              </small>
            </div>
          </div>

          {/* Do not send payment link checkbox */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingTop: 4 }}>
            <input
              type="checkbox"
              id="doNotSend"
              checked={doNotSendDirect}
              onChange={(e) => setDoNotSendDirect(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <label htmlFor="doNotSend" style={{ cursor: "pointer" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", display: "block" }}>
                Generate links for manual sharing only
              </span>
              <span style={{ fontSize: 11.5, color: "var(--muted)", display: "block" }}>
                Links will be generated without triggering automated dispatch. You can copy and share them manually.
              </span>
            </label>
          </div>
        </div>

        {/* CARD 2: ADD PAYERS */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 12,
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 750, color: "var(--ink, #0f172a)", margin: 0 }}>
                Select Payers
              </h3>
              <p style={{ fontSize: 12.5, color: "var(--muted, #64748b)", margin: "3px 0 0" }}>
                Choose members from directory or add a new payer directly.
              </p>
            </div>

            <Badge tone="green">{selectedPersonIds.size} Selected</Badge>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
            <button
              type="button"
              onClick={() => setActivePayerTab("list")}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: activePayerTab === "list" ? "#ecfdf5" : "#f8fafc",
                color: activePayerTab === "list" ? "#059669" : "var(--muted)",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Members Directory ({allPeople.length})
            </button>

            <button
              type="button"
              onClick={() => setActivePayerTab("manual")}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: activePayerTab === "manual" ? "#ecfdf5" : "#f8fafc",
                color: activePayerTab === "manual" ? "#059669" : "var(--muted)",
                fontSize: 12.5,
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Add New Payer
            </button>
          </div>

          {/* TAB 1: MEMBERS LIST */}
          {activePayerTab === "list" && (
            <>
              {/* Search Box */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "6px 12px",
                  }}
                >
                  <Icon name="search" size={14} />
                  <input
                    type="text"
                    placeholder="Search members by name or mobile number…"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    style={{ border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Members Table */}
              <div className="table-wrap" style={{ maxHeight: 340, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                {peopleLoading ? (
                  <div className="empty-state" style={{ padding: 24 }}>
                    <div className="state-spinner" />
                    <p>Loading directory…</p>
                  </div>
                ) : filteredPeople.length === 0 ? (
                  <div className="empty-state" style={{ padding: 24 }}>
                    <p>No members found matching your search.</p>
                  </div>
                ) : (
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ width: 44, padding: "9px 12px" }}>
                          <input
                            type="checkbox"
                            checked={
                              filteredPeople.length > 0 &&
                              filteredPeople.every((p) => selectedPersonIds.has(p.id))
                            }
                            onChange={() => selectAllFiltered(filteredPeople)}
                          />
                        </th>
                        <th style={{ padding: "9px 12px" }}>Name</th>
                        <th style={{ padding: "9px 12px" }}>Mobile Number</th>
                        <th style={{ padding: "9px 12px" }}>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPeople.map((person, idx) => {
                        const personKey = person.id || `person-${idx}`;
                        const isSelected = person.id ? selectedPersonIds.has(person.id) : false;
                        return (
                          <tr
                            key={personKey}
                            style={{ background: isSelected ? "#f0fdf4" : undefined, cursor: "pointer" }}
                            onClick={() => person.id && toggleSelectPerson(person.id)}
                          >
                            <td style={{ padding: "9px 12px" }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => person.id && toggleSelectPerson(person.id)}
                              />
                            </td>
                            <td style={{ padding: "9px 12px" }}>
                              <strong style={{ fontSize: 13, color: "var(--ink)" }}>{person.displayName || "Member"}</strong>
                            </td>
                            <td style={{ padding: "9px 12px" }}>
                              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                                {person.primaryPhone || "—"}
                              </span>
                            </td>
                            <td style={{ padding: "9px 12px" }}>
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                                {person.email || "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* TAB 2: ADD MANUALLY */}
          {activePayerTab === "manual" && (
            <form onSubmit={handleAddManualPayer} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 440 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4, display: "block" }}>
                  Full Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4, display: "block" }}>
                  Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-sm"
                style={{ background: "#059669", borderColor: "#059669", alignSelf: "flex-start", padding: "7px 16px" }}
              >
                Add and Select Payer
              </button>
            </form>
          )}
        </div>

        {/* CARD 3: ACTION FOOTER */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 12,
            padding: "16px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div>
            <strong style={{ fontSize: 14, color: "var(--ink)", display: "block" }}>
              {selectedPersonIds.size} Payer{selectedPersonIds.size === 1 ? "" : "s"} Selected
            </strong>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {numAmount > 0
                ? `₹${numAmount.toLocaleString("en-IN")} per person · Total: ₹${(numAmount * selectedPersonIds.size).toLocaleString("en-IN")}`
                : "Enter amount above to generate payment links"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={submitting}
              style={{ padding: "8px 16px", fontSize: 13, fontWeight: 650 }}
            >
              Clear All
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSendQuickCollect()}
              disabled={submitting}
              style={{
                background: "#059669",
                borderColor: "#059669",
                padding: "9px 20px",
                fontSize: 13.5,
                fontWeight: 750,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                cursor: "pointer",
              }}
            >
              <Icon name="zap" size={15} />
              <span>{submitting ? "Generating Links…" : "Generate Payment Links"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Copy Feedback Toast */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#0f172a",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon name="check" size={15} />
          <span>{toastMessage}</span>
        </div>
      )}
    </AppShell>
  );
}

export default function QuickCollectPage() {
  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <div className="state-spinner" />
          <p>Loading Quick Collect…</p>
        </div>
      }
    >
      <QuickCollectContent />
    </Suspense>
  );
}
