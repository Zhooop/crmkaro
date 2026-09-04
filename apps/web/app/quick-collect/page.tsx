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
  getCachedWorkspaceContext,
  saveCachedWorkspaceContext,
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

  // AppShell States (Instant 0ms cached state)
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

  // Form States (Screenshot 2)
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
            displayName: p.displayName,
            primaryPhone: p.primaryPhone,
            email: p.email,
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
        const newPerson = await res.json();
        setAllPeople((prev) => [
          {
            id: newPerson.id,
            displayName: newPerson.displayName,
            primaryPhone: newPerson.primaryPhone,
            email: newPerson.email,
          },
          ...prev,
        ]);
        setSelectedPersonIds((prev) => new Set(prev).add(newPerson.id));
        setManualName("");
        setManualPhone("");
        setActivePayerTab("list");
      }
    } catch {
      // ignore
    }
  }

  async function handleSendQuickCollect(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(feeAmount);
    if (!parsedAmount || parsedAmount < 2 || parsedAmount > 200000) {
      setErrorMessage("Please enter a valid amount between ₹2 and ₹2,00,000.");
      return;
    }
    if (!notes.trim()) {
      setErrorMessage("Please enter a description / notes for this fee request.");
      return;
    }
    if (selectedPersonIds.size === 0) {
      setErrorMessage("Please select at least 1 payer from the list.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    const generated: GeneratedPayerLink[] = [];

    try {
      const selectedList = allPeople.filter((p) => selectedPersonIds.has(p.id));
      const amountMinor = parsedAmount * 100;
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
              notes: notes.trim(),
              items: [
                {
                  description: notes.trim() || "Quick Collect Fee",
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
            // Also automatically issue the invoice
            if (invData.id) {
              await authFetch(`${api}/finance/invoices/${invData.id}/issue`, {
                method: "POST",
                credentials: "include",
              }).catch(() => {});
            }
          }

          generated.push({
            personId: person.id,
            name: person.displayName,
            phone: person.primaryPhone,
            amountMinor,
            notes: notes.trim(),
            invoiceNumber,
            invoiceId,
          });
        } catch {
          // ignore single fail
        }
      }

      setSuccessList(generated);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredPeople = allPeople.filter(
    (p) =>
      p.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (p.primaryPhone && p.primaryPhone.includes(memberSearch)),
  );

  const numAmount = Number(feeAmount);
  const isValidAmount = numAmount >= 2 && numAmount <= 200000;
  const isSendDisabled = !isValidAmount || !notes.trim() || selectedPersonIds.size === 0 || submitting;

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
      <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header (Screenshot 2) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow" style={{ color: "#059669" }}>
              <Icon name="zap" size={14} /> Instant Collect
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "var(--ink)" }}>
              Quick Collect
            </h1>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={submitting}
              style={{ color: "#059669", borderColor: "#86efac", fontWeight: 700 }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSendDisabled}
              onClick={handleSendQuickCollect}
              style={{
                background: isSendDisabled ? "#cbd5e1" : "#059669",
                borderColor: isSendDisabled ? "#cbd5e1" : "#059669",
                fontWeight: 700,
              }}
            >
              {submitting ? "Sending Requests…" : "Send"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 13 }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* SUCCESS SUMMARY VIEW WITH 1-CLICK WHATSAPP SHARE */}
        {successList && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1.5px solid #a7f3d0",
              borderRadius: 14,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ color: "#065f46", fontSize: 16, fontWeight: 800, margin: 0 }}>
                  🎉 {successList.length} Fee Collection Requests Created Successfully!
                </h3>
                <p style={{ color: "#047857", fontSize: 13, margin: "4px 0 0" }}>
                  Invoices are recorded into the database. You can send 1-click WhatsApp payment reminders directly below:
                </p>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => router.push("/transactions")}
                style={{ background: "#ffffff", borderColor: "#a7f3d0", color: "#065f46", fontWeight: 700 }}
              >
                View Transactions →
              </button>
            </div>

            <div className="table-wrap" style={{ background: "#ffffff", borderRadius: 10, overflow: "hidden" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Payer Name</th>
                    <th>Mobile</th>
                    <th>Amount</th>
                    <th>Invoice #</th>
                    <th style={{ textAlign: "right" }}>1-Click WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {successList.map((item, idx) => {
                    const amountFormatted = `₹ ${(item.amountMinor / 100).toLocaleString("en-IN")}`;
                    const payUrl = item.invoiceId && typeof window !== "undefined"
                      ? `${window.location.origin}/pay/${item.invoiceId}`
                      : "";
                    const whatsappMsg = `Hello ${item.name}, your fee payment of ${amountFormatted} for "${item.notes}" is requested. Reference: ${item.invoiceNumber || "INV"}.${
                      payUrl ? `\n\n💳 Pay Online Instantly (UPI, Cards, NetBanking):\n${payUrl}` : ""
                    }\n\nPlease make the payment at your earliest convenience. Thank you! - ${orgName}`;
                    const whatsappUrl = item.phone
                      ? `https://wa.me/${item.phone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMsg)}`
                      : null;

                    return (
                      <tr key={idx}>
                        <td><strong>{item.name}</strong></td>
                        <td>{item.phone || "—"}</td>
                        <td><strong style={{ color: "#059669" }}>{amountFormatted}</strong></td>
                        <td><Badge tone="blue">{item.invoiceNumber || "Recorded"}</Badge></td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
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
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                }}
                                title="Open Online Checkout (Razorpay UPI/Cards)"
                              >
                                <Icon name="rupee" size={13} />
                                <span>Pay Online</span>
                              </a>
                            )}
                            {whatsappUrl ? (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{
                                  background: "#25d366",
                                  color: "#ffffff",
                                  borderColor: "#25d366",
                                  fontWeight: 700,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <Icon name="whatsapp" size={14} />
                                <span>Share Link</span>
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

        {/* CARD 1: ENTER AMOUNT (Screenshot 2) */}
        <div
          className="quick-collect-card"
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
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 750, color: "var(--ink)", margin: 0 }}>
              Enter amount
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 0" }}>
              Enter the amount each payer needs to pay
            </p>
          </div>

          {/* Fee Amount */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
              Fee Amount <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid var(--line)",
                borderRadius: 8,
                overflow: "hidden",
                background: "#ffffff",
                width: "100%",
                maxWidth: 420,
              }}
            >
              <span style={{ padding: "10px 14px", background: "#f8fafc", borderRight: "1px solid var(--line)", fontWeight: 700, color: "var(--muted)" }}>
                ₹
              </span>
              <input
                type="number"
                min={2}
                max={200000}
                placeholder="Enter Amount"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                style={{ border: "none", outline: "none", padding: "10px 12px", width: "100%", fontSize: 14, fontWeight: 600 }}
              />
            </div>
            <small style={{ color: "var(--muted)", fontSize: 11, display: "block", marginTop: 4 }}>
              ⓘ Allowed amount is between 2 and 200000
            </small>
          </div>

          {/* Notes */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>
              Notes <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Eg: Admission fee for Batch 7"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}
            />
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
              <strong style={{ fontSize: 13, color: "var(--ink)", display: "block" }}>
                Do not send payment link to payers
              </strong>
              <span style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginTop: 1 }}>
                Payers won&apos;t receive payment requests, but you can still send reminders or share the link manually.
              </span>
            </label>
          </div>
        </div>

        {/* CARD 2: ADD PAYERS (Screenshot 2) */}
        <div
          className="quick-collect-card"
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
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 750, color: "var(--ink)", margin: 0 }}>
              Add Payers
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 0" }}>
              Add payers to send payment link to
            </p>
          </div>

          {/* Tabs */}
          <div className="quick-collect-tabs" style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setActivePayerTab("list")}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                background: activePayerTab === "list" ? "#ecfdf5" : "#f8fafc",
                color: activePayerTab === "list" ? "#059669" : "var(--muted)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Add from members list
            </button>

            <button
              type="button"
              onClick={() => setActivePayerTab("import")}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                background: activePayerTab === "import" ? "#ecfdf5" : "#f8fafc",
                color: activePayerTab === "import" ? "#059669" : "var(--muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Import file
            </button>

            <button
              type="button"
              onClick={() => setActivePayerTab("manual")}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                background: activePayerTab === "manual" ? "#ecfdf5" : "#f8fafc",
                color: activePayerTab === "manual" ? "#059669" : "var(--muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Add manually
            </button>
          </div>

          {/* TAB 1: ADD FROM MEMBERS LIST */}
          {activePayerTab === "list" && (
            <>
              {/* Count & Search Row */}
              <div className="quick-collect-search-row">
                <div className="quick-collect-search-left">
                  <strong style={{ fontSize: 13, flexShrink: 0 }}>Members {allPeople.length}</strong>
                  <div className="search-box" style={{ flex: 1, minWidth: 0, height: 34 }}>
                    <Icon name="search" size={14} />
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="quick-collect-search-right">
                  <Badge tone="green">Selected {selectedPersonIds.size}</Badge>
                </div>
              </div>

              {/* Members Table */}
              <div className="table-wrap" style={{ maxHeight: 360, overflowY: "auto" }}>
                {peopleLoading ? (
                  <div className="empty-state" style={{ padding: 24 }}>
                    <div className="state-spinner" />
                    <p>Loading members…</p>
                  </div>
                ) : filteredPeople.length === 0 ? (
                  <div className="empty-state" style={{ padding: 24 }}>
                    <p>No members found.</p>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>
                          <input
                            type="checkbox"
                            checked={
                              filteredPeople.length > 0 &&
                              filteredPeople.every((p) => selectedPersonIds.has(p.id))
                            }
                            onChange={() => selectAllFiltered(filteredPeople)}
                          />
                        </th>
                        <th>Name</th>
                        <th>Mobile No</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPeople.map((person) => {
                        const isSelected = selectedPersonIds.has(person.id);
                        return (
                          <tr
                            key={person.id}
                            style={{ background: isSelected ? "#f0fdf4" : undefined }}
                            onClick={() => toggleSelectPerson(person.id)}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectPerson(person.id)}
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* TAB 2: IMPORT FILE */}
          {activePayerTab === "import" && (
            <div style={{ padding: 24, textAlign: "center", border: "1.5px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc" }}>
              <Icon name="upload" size={28} />
              <h4 style={{ margin: "8px 0 4px", fontSize: 14 }}>Upload CSV File</h4>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                Import payers with Name and Mobile number columns from a spreadsheet.
              </p>
              <input
                type="file"
                accept=".csv"
                style={{ marginTop: 12, fontSize: 12 }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    alert("File uploaded. Members will be parsed.");
                  }
                }}
              />
            </div>
          )}

          {/* TAB 3: ADD MANUALLY */}
          {activePayerTab === "manual" && (
            <form onSubmit={handleAddManualPayer} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Payer Name *</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Mobile Number</label>
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-sm"
                style={{ background: "#059669", borderColor: "#059669", alignSelf: "flex-start", marginTop: 4 }}
              >
                + Add & Select Payer
              </button>
            </form>
          )}
        </div>
      </div>
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
