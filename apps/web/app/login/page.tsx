"use client";

import { AuthPanel } from "@crmkaro/ui";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="auth-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div className="state-spinner" />
      </main>
    );
  }

  return (
    <div suppressHydrationWarning>
      <AuthPanel
        apiUrl={process.env.NEXT_PUBLIC_API_URL}
        initialMode={mode}
        onAuthenticated={() => {
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <div className="state-spinner" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
