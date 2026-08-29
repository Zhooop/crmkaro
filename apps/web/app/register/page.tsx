"use client";

import { AuthPanel } from "@crmkaro/ui";

export default function RegisterPage() {
  return (
    <AuthPanel
      apiUrl={process.env.NEXT_PUBLIC_API_URL}
      initialMode="register"
      onAuthenticated={() => {
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      }}
    />
  );
}
