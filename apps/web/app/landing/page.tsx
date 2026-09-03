"use client";

import { LandingPage } from "@crmkaro/ui";
import { useEffect, useState } from "react";
import { authFetch, getApiUrl } from "@/lib/api";

function openInNewTab(path: string) {
  if (typeof window === "undefined") return;
  const host = window.location.hostname.toLowerCase();
  const url =
    host === "crmkaro.com" || host === "www.crmkaro.com"
      ? `https://web.crmkaro.com${path}`
      : path;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function PublicLandingPage() {
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
      onLoginClick={() => openInNewTab("/login")}
      onRegisterClick={() => openInNewTab("/login?mode=register")}
      onDashboardClick={() => openInNewTab("/")}
    />
  );
}
