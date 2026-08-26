"use client";

import { AuthPanel } from "@crmkaro/ui";
import { useRouter } from "next/navigation";
export default function LoginPage() {
  const router = useRouter();
  return (
    <AuthPanel
      apiUrl={process.env.NEXT_PUBLIC_API_URL}
      onAuthenticated={() => router.replace("/")}
    />
  );
}
