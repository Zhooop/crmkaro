"use client";

import { LandingPage } from "@crmkaro/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

function navigateToWebPortal(path: string, router: ReturnType<typeof useRouter>) {
  if (typeof window === "undefined") return;
  const host = window.location.hostname;
  if (host === "crmkaro.com" || host === "www.crmkaro.com") {
    window.location.href = `https://web.crmkaro.com${path}`;
    return;
  }
  router.push(path);
}

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
      onLoginClick={() => navigateToWebPortal("/login", router)}
      onRegisterClick={() => navigateToWebPortal("/login?mode=register", router)}
      onDashboardClick={() => navigateToWebPortal("/", router)}
    />
  );
}
