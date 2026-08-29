"use client";

import { AuthPanel } from "@crmkaro/ui";

export default function LoginPage() {
  return (
    <AuthPanel
      apiUrl={process.env.NEXT_PUBLIC_API_URL}
      onAuthenticated={() => {
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      }}
    />
  );
}
