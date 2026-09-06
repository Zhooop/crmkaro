import React, { createContext, useContext, useEffect, useState } from "react";
import { Linking } from "react-native";
import { apiFetch, getAuthToken, removeAuthToken, setAuthToken, setActiveOrgId, getActiveOrgId } from "../api/client";

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export type Organisation = {
  id: string;
  name: string;
  slug: string;
  businessType?: string | null;
  role?: string;
};

type AuthContextType = {
  user: User | null;
  organisations: Organisation[];
  activeOrg: Organisation | null;
  loading: boolean;
  needsSetup: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  requestEmailOtp: (email: string, mode: "login" | "register") => Promise<{ success: boolean; challengeId?: string; error?: string; message?: string }>;
  verifyEmailOtp: (challengeId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  createOrganisation: (data: { name: string; businessType: string; serviceCodes: string[] }) => Promise<{ success: boolean; error?: string }>;
  loginWithToken: (token: string) => Promise<boolean>;
  loginAsDemo: () => void;
  logout: () => Promise<void>;
  switchOrganisation: (org: Organisation) => Promise<void>;
  refreshContext: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const DEMO_USER: User = {
  id: "demo-user-001",
  email: "demo@crmkaro.com",
  name: "Nitesh Sharma",
  role: "OWNER",
};

const DEMO_ORG: Organisation = {
  id: "demo-org-001",
  name: "CRMKaro Academy & Studio",
  slug: "crmkaro-academy",
  businessType: "COACHING_ACADEMY",
  role: "OWNER",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  async function loadUserSession() {
    setLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setUser(null);
        setActiveOrg(null);
        setOrganisations([]);
        setNeedsSetup(false);
        setLoading(false);
        return;
      }

      // If in demo mode
      if (token === "DEMO_SESSION_TOKEN") {
        setUser(DEMO_USER);
        setActiveOrg(DEMO_ORG);
        setOrganisations([DEMO_ORG]);
        setNeedsSetup(false);
        setLoading(false);
        return;
      }

      // Fetch user profile from API
      const meRes = await apiFetch<User>("/auth/me");
      if (meRes.error || !meRes.data) {
        await removeAuthToken();
        setUser(null);
        setActiveOrg(null);
        setOrganisations([]);
        setNeedsSetup(false);
        setLoading(false);
        return;
      }

      setUser(meRes.data);

      // Fetch user organisations
      const orgsRes = await apiFetch<any[]>("/organisations");
      if (orgsRes.data && Array.isArray(orgsRes.data)) {
        const orgList = orgsRes.data
          .map((item) => {
            const org = item.organisation || item;
            if (!org?.id) return null;
            return {
              id: org.id,
              name: org.name || "Workspace",
              slug: org.slug || "workspace",
              businessType: org.businessType || null,
              role: item.role?.name || org.role || "Admin",
            };
          })
          .filter(Boolean) as Organisation[];

        setOrganisations(orgList);

        if (orgList.length === 0) {
          setNeedsSetup(true);
          setActiveOrg(null);
        } else {
          setNeedsSetup(false);
          const savedOrgId = await getActiveOrgId();
          const found = orgList.find((o) => o.id === savedOrgId) || orgList[0] || null;
          setActiveOrg(found);
          if (found) {
            await setActiveOrgId(found.id);
            await apiFetch(`/organisations/${found.id}/activate`, { method: "POST" });
          }
        }
      } else {
        setNeedsSetup(true);
        setActiveOrg(null);
      }
    } catch {
      setUser(null);
      setActiveOrg(null);
      setOrganisations([]);
      setNeedsSetup(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserSession();

    const handleDeepLink = async (event: { url: string } | null) => {
      if (!event?.url) return;
      try {
        const url = event.url;
        if (url.startsWith("com.crmkaro.app://") || url.startsWith("crmkaro://")) {
          const match = url.match(/[?&]token=([^&#]+)/);
          if (match && match[1]) {
            const token = decodeURIComponent(match[1]);
            await setAuthToken(token);
            await loadUserSession();
          }
        }
      } catch (e) {
        console.warn("Failed to process deep link:", e);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => sub.remove();
  }, []);

  async function requestEmailOtp(email: string, mode: "login" | "register") {
    const res = await apiFetch<{ challengeId?: string; message?: string }>("/auth/email/request-otp", {
      method: "POST",
      body: JSON.stringify({ email, mode }),
    });

    if (res.error || !res.data) {
      return {
        success: false,
        error: res.error || "Failed to send verification code.",
      };
    }

    return {
      success: true,
      challengeId: res.data.challengeId,
      message: res.data.message || "A 6-digit verification code was sent to your email.",
    };
  }

  async function verifyEmailOtp(challengeId: string, code: string) {
    const res = await apiFetch<{ token?: string; userId?: string }>("/auth/email/verify-otp", {
      method: "POST",
      body: JSON.stringify({ challengeId, code }),
    });

    if (res.error || !res.data?.token) {
      return {
        success: false,
        error: res.error || "Invalid verification code. Please check and try again.",
      };
    }

    await setAuthToken(res.data.token);
    await loadUserSession();
    return { success: true };
  }

  async function adminLogin(email: string, password: string) {
    const res = await apiFetch<{ token?: string; user?: User }>("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (res.error || !res.data) {
      return { success: false, error: res.error || "Login failed. Invalid credentials." };
    }

    const token = res.data.token;
    if (token) {
      await setAuthToken(token);
      await loadUserSession();
      return { success: true };
    }

    return { success: false, error: "Authentication token missing." };
  }

  async function login(email: string, password: string) {
    return adminLogin(email, password);
  }

  async function loginWithToken(token: string) {
    await setAuthToken(token);
    await loadUserSession();
    return true;
  }

  async function createOrganisation(data: {
    name: string;
    businessType: string;
    serviceCodes: string[];
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await apiFetch<any>("/organisations", {
        method: "POST",
        body: JSON.stringify({
          name: data.name.trim(),
          businessType: data.businessType,
          timezone: "Asia/Kolkata",
          currency: "INR",
          serviceCodes: data.serviceCodes,
        }),
      });

      if (res.error || !res.data) {
        return { success: false, error: res.error || "Failed to create workspace." };
      }

      const newOrgId = res.data.id;
      if (newOrgId) {
        await setActiveOrgId(newOrgId);
        await apiFetch(`/organisations/${newOrgId}/activate`, { method: "POST" });
      }

      await loadUserSession();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to create workspace." };
    }
  }

  function loginAsDemo() {
    setUser(DEMO_USER);
    setActiveOrg(DEMO_ORG);
    setOrganisations([DEMO_ORG]);
    setNeedsSetup(false);
    setAuthToken("DEMO_SESSION_TOKEN").catch(() => {});
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {}
    await removeAuthToken();
    setUser(null);
    setActiveOrg(null);
    setOrganisations([]);
    setNeedsSetup(false);
  }

  async function switchOrganisation(org: Organisation) {
    setActiveOrg(org);
    await setActiveOrgId(org.id);
    await apiFetch(`/organisations/${org.id}/activate`, { method: "POST" });
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        organisations,
        activeOrg,
        loading,
        needsSetup,
        login,
        requestEmailOtp,
        verifyEmailOtp,
        adminLogin,
        createOrganisation,
        loginWithToken,
        loginAsDemo,
        logout,
        switchOrganisation,
        refreshContext: loadUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
