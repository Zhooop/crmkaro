"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host === "crmkaro.com" || host === "www.crmkaro.com") {
        window.location.replace("https://crmkaro.com/");
      } else if (host === "web.crmkaro.com" || host === "app.crmkaro.com") {
        window.location.replace("https://web.crmkaro.com/");
      } else {
        router.replace("/");
      }
    }
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "#ffffff",
        gap: 14,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          border: "3px solid #38bdf8",
          borderTopColor: "transparent",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>
        Redirecting to CRMKaro...
      </p>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
