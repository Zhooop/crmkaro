"use client";

import { useEffect, useState, use } from "react";
import Head from "next/head";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxMinor: number;
  lineTotalMinor: number;
}

interface PublicInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
  currency: string;
  notes: string | null;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  grandTotalMinor: number;
  paidTotalMinor: number;
  balanceDueMinor: number;
  organisation: {
    id: string;
    name: string;
    businessType: string | null;
    currency: string;
  };
  customer: {
    id: string;
    displayName: string;
    primaryPhone: string | null;
    email: string | null;
  };
  items: InvoiceItem[];
  latestReceipt?: {
    receiptNumber: string;
    amountMinor: number;
    method: string;
    receivedAt: string;
    reference: string | null;
  } | null;
  razorpayKeyId: string;
}

function formatMoney(amountMinor: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export default function PublicPayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params);
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    receiptNumber: string;
    amountPaidMinor: number;
  } | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

  // Load public invoice
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/public/invoices/${invoiceId}`);
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || "Invoice not found or link expired.");
        }
        const data = await res.json();
        if (isMounted) {
          setInvoice(data);
          if (data.status === "PAID" && data.latestReceipt) {
            setPaymentSuccess({
              receiptNumber: data.latestReceipt.receiptNumber,
              amountPaidMinor: data.latestReceipt.amountMinor,
            });
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load invoice details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, invoiceId]);

  // Load Razorpay Checkout Script
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!document.getElementById("razorpay-checkout-js")) {
      const script = document.createElement("script");
      script.id = "razorpay-checkout-js";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handlePayNow = async () => {
    if (!invoice) return;

    try {
      setPaying(true);

      // 1. Create Order
      const orderRes = await fetch(`${apiUrl}/public/invoices/${invoiceId}/create-razorpay-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.message || "Could not initialize payment order.");
      }

      const orderData = await orderRes.json();

      if (!window.Razorpay) {
        throw new Error("Payment gateway is loading. Please try again in 2 seconds.");
      }

      // 2. Open Razorpay Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amountMinor,
        currency: orderData.currency || "INR",
        name: invoice.organisation.name,
        description: `Payment for Invoice #${invoice.invoiceNumber}`,
        image: "/brand/crmkaro-mark.png",
        order_id: orderData.orderId,
        prefill: {
          name: invoice.customer.displayName || "",
          contact: invoice.customer.primaryPhone || "",
          email: invoice.customer.email || "",
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // 3. Verify Signature
            const verifyRes = await fetch(`${apiUrl}/public/invoices/${invoiceId}/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.message || "Payment verification failed.");
            }

            setPaymentSuccess({
              receiptNumber: verifyData.receiptNumber,
              amountPaidMinor: verifyData.amountPaidMinor,
            });

            // Update local status
            setInvoice((prev) => (prev ? { ...prev, status: "PAID", balanceDueMinor: 0 } : null));
          } catch (err: any) {
            alert(`Payment completed but verification failed: ${err.message}`);
          } finally {
            setPaying(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        alert(`Payment Failed: ${response.error?.description || "Transaction was declined."}`);
        setPaying(false);
      });
      rzp.open();
    } catch (err: any) {
      alert(err.message || "Failed to initiate payment.");
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: "3px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
          <p style={{ color: "#475569", fontWeight: 600, fontSize: 14 }}>Loading secure checkout…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", padding: 20, fontFamily: "sans-serif" }}>
        <div style={{ maxWidth: 440, width: "100%", background: "#ffffff", padding: 32, borderRadius: 16, border: "1px solid #e2e8f0", textAlign: "center", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 16px" }}>⚠️</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#0f172a" }}>Invoice Unavailable</h2>
          <p style={{ color: "#64748b", fontSize: 13.5, lineHeight: 1.5, margin: "0 0 20px" }}>{error || "The payment link you followed is invalid or has expired."}</p>
          <a href="/" style={{ display: "inline-block", background: "#2563eb", color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Go to CRMKaro</a>
        </div>
      </main>
    );
  }

  const isPaid = invoice.status === "PAID" || !!paymentSuccess;

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 260px)", padding: "32px 16px 60px", fontFamily: "Inter, system-ui, sans-serif", color: "#0f172a" }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        {/* Brand Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#ffffff", display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(37, 99, 235, 0.12)", border: "1px solid #dbeafe" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>
                {invoice.organisation.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "#0f172a" }}>{invoice.organisation.name}</h2>
              <span style={{ fontSize: 11.5, color: "#2563eb", fontWeight: 600 }}>✓ Verified Business · 100% Secure Checkout</span>
            </div>
          </div>

          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", background: "#ffffff", padding: "4px 9px", borderRadius: 20, border: "1px solid #e2e8f0" }}>
            Invoice #{invoice.invoiceNumber}
          </span>
        </div>

        {/* Main Card */}
        <div style={{ background: "#ffffff", borderRadius: 18, border: "1px solid #e2e8f0", boxShadow: "0 12px 35px -8px rgba(15, 23, 42, 0.08)", overflow: "hidden" }}>
          
          {/* Header Banner */}
          {isPaid ? (
            <div style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", padding: "26px 24px", color: "#ffffff", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#ffffff", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 26, fontWeight: 800, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>✓</div>
              <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Payment Received & Cleared!</h1>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
                Receipt: <strong>{paymentSuccess?.receiptNumber || invoice.latestReceipt?.receiptNumber || "REC-PAID"}</strong>
              </p>
            </div>
          ) : (
            <div style={{ background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)", padding: "28px 24px", color: "#ffffff" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.85 }}>Total Payment Requested</span>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 6 }}>
                <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em" }}>
                  {formatMoney(invoice.balanceDueMinor, invoice.currency)}
                </h1>
                <span style={{ fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 20 }}>
                  Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "Immediate"}
                </span>
              </div>
            </div>
          )}

          {/* Details Body */}
          <div style={{ padding: "24px" }}>
            {/* Payer & Due Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, paddingBottom: 18, borderBottom: "1px solid #f1f5f9", marginBottom: 18 }}>
              <div>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Billed To</span>
                <strong style={{ display: "block", fontSize: 14, color: "#0f172a", marginTop: 2 }}>{invoice.customer.displayName}</strong>
                {invoice.customer.primaryPhone && (
                  <span style={{ fontSize: 12, color: "#64748b" }}>{invoice.customer.primaryPhone}</span>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Issue Date</span>
                <strong style={{ display: "block", fontSize: 13.5, color: "#0f172a", marginTop: 2 }}>
                  {new Date(invoice.issueDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </strong>
                <span style={{ fontSize: 11, color: isPaid ? "#16a34a" : "#ea580c", fontWeight: 700 }}>
                  Status: {isPaid ? "PAID" : "PENDING"}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 10 }}>Order Summary</span>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px", borderRadius: "6px 0 0 6px" }}>Item / Description</th>
                    <th style={{ padding: "8px 10px", textAlign: "center" }}>Qty</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", borderRadius: "0 6px 6px 0" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "11px 10px", fontWeight: 600, color: "#0f172a" }}>{item.description}</td>
                      <td style={{ padding: "11px 10px", textAlign: "center", color: "#64748b" }}>{item.quantity}</td>
                      <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                        {formatMoney(item.lineTotalMinor, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}>
                <span>Subtotal:</span>
                <span>{formatMoney(invoice.subtotalMinor, invoice.currency)}</span>
              </div>
              {invoice.discountMinor > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#16a34a" }}>
                  <span>Discount:</span>
                  <span>- {formatMoney(invoice.discountMinor, invoice.currency)}</span>
                </div>
              )}
              {invoice.taxMinor > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}>
                  <span>Taxes:</span>
                  <span>+ {formatMoney(invoice.taxMinor, invoice.currency)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #e2e8f0", fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                <span>Total Amount Due:</span>
                <span style={{ color: "#2563eb" }}>{formatMoney(invoice.balanceDueMinor, invoice.currency)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            {isPaid ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#059669",
                    color: "#ffffff",
                    border: 0,
                    borderRadius: 12,
                    fontSize: 14.5,
                    fontWeight: 750,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 4px 14px rgba(5, 150, 105, 0.3)",
                  }}
                >
                  <span>🖨️ Print / Save Official Receipt</span>
                </button>
                <div style={{ textAlign: "center", fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                  Payment settled and verified in {invoice.organisation.name}&apos;s database.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  type="button"
                  onClick={handlePayNow}
                  disabled={paying}
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: paying ? "#93c5fd" : "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
                    color: "#ffffff",
                    border: 0,
                    borderRadius: 12,
                    fontSize: 15.5,
                    fontWeight: 800,
                    cursor: paying ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: "0 6px 20px -2px rgba(37, 99, 235, 0.4)",
                    transition: "all 0.18s ease",
                  }}
                >
                  <span>⚡ Pay {formatMoney(invoice.balanceDueMinor, invoice.currency)} Now</span>
                  <span style={{ fontSize: 12, background: "rgba(255,255,255,0.25)", padding: "2px 8px", borderRadius: 6 }}>
                    UPI / Card / NetBanking
                  </span>
                </button>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, color: "#64748b", fontSize: 11, fontWeight: 600 }}>
                  <span>🔒 256-Bit Encrypted</span>
                  <span>·</span>
                  <span>⚡ Instant Razorpay UPI</span>
                  <span>·</span>
                  <span>🧾 Official Receipt Auto-Issued</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11.5, color: "#94a3b8" }}>
          Powered by <strong style={{ color: "#64748b" }}>CRMKaro Cloud</strong> · India&apos;s Smartest Business Operating System
        </div>
      </div>
    </main>
  );
}
