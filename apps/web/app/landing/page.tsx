"use client";

import { LandingPage } from "@crmkaro/ui";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";

export default function PublicLandingPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (typeof window !== "undefined") {
          const host = window.location.hostname.toLowerCase();
          if (host === "crmkaro.com" || host === "www.crmkaro.com") return;
        }
        const token = typeof window !== "undefined" ? localStorage.getItem("crmkaro_token") : null;
        if (!token) return;
        const api = getApiUrl();
        const res = await authFetch(`${api}/auth/me`);
        if (res.ok) {
          setIsAuthenticated(true);
        } else if (res.status === 401) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("crmkaro_token");
          }
        }
      } catch {
        // Not authenticated
      }
    }
    checkAuth();
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    if (host === "crmkaro.com" || host === "www.crmkaro.com") {
      window.location.href = `https://web.crmkaro.com${path}`;
    } else {
      router.push(path);
    }
  };

  return (
    <LandingPage
      isAuthenticated={isAuthenticated}
      onLoginClick={() => navigateTo("/login")}
      onRegisterClick={() => navigateTo("/login")}
      onDashboardClick={() => navigateTo("/")}
    />
  );
}
