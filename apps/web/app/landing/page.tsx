"use client";

import { LandingPage } from "@crmkaro/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

export default function PublicLandingPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const api = getApiUrl();
        const res = await authFetch(`${api}/dashboard`);
        if (res.ok || res.status === 403) {
          setIsAuthenticated(true);
        }
      } catch {
        // Not authenticated
      }
    }
    checkAuth();
  }, []);

  return (
    <LandingPage
      isAuthenticated={isAuthenticated}
      onLoginClick={() => router.push("/login")}
      onRegisterClick={() => router.push("/login?mode=register")}
      onDashboardClick={() => router.push("/")}
    />
  );
}
