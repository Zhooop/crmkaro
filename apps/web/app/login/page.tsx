"use client";

import { AuthPanel } from "@crmkaro/ui";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "register" ? "register" : "login";

  return (
    <AuthPanel
      apiUrl={process.env.NEXT_PUBLIC_API_URL}
      initialMode={mode}
      onAuthenticated={() => {
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      }}
    />
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
