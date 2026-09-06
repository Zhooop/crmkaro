import React, { createContext, useContext, useEffect, useState } from "react";
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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  requestEmailOtp: (email: string, mode: "login" | "register") => Promise<{ success: boolean; challengeId?: string; error?: string; message?: string }>;
  verifyEmailOtp: (challengeId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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

  async function loadUserSession() {
    setLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setUser(null);
        setActiveOrg(null);
        setLoading(false);
        return;
      }

      // If in demo mode
      if (token === "DEMO_SESSION_TOKEN") {
        setUser(DEMO_USER);
        setActiveOrg(DEMO_ORG);
        setOrganisations([DEMO_ORG]);
        setLoading(false);
        return;
      }

      // Fetch user profile from API
      const meRes = await apiFetch<User>("/auth/me");
      if (meRes.error || !meRes.data) {
        await removeAuthToken();
        setUser(null);
        setActiveOrg(null);
        setLoading(false);
        return;
      }

      setUser(meRes.data);

      // Fetch user organisations
      const orgsRes = await apiFetch<any[]>("/organisations");
      if (orgsRes.data) {
        const orgList = orgsRes.data.map((item) => ({
          id: item.organisation?.id || item.id,
          name: item.organisation?.name || item.name,
          slug: item.organisation?.slug || item.slug,
          businessType: item.organisation?.businessType || item.businessType,
          role: item.role?.name || item.role,
        }));
        setOrganisations(orgList);

        const savedOrgId = await getActiveOrgId();
        const found = orgList.find((o) => o.id === savedOrgId) || orgList[0] || null;
        setActiveOrg(found);
        if (found) {
          await setActiveOrgId(found.id);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserSession();
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

  function loginAsDemo() {
    setUser(DEMO_USER);
    setActiveOrg(DEMO_ORG);
    setOrganisations([DEMO_ORG]);
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
  }

  async function switchOrganisation(org: Organisation) {
    setActiveOrg(org);
    await setActiveOrgId(org.id);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        organisations,
        activeOrg,
        loading,
        login,
        requestEmailOtp,
        verifyEmailOtp,
        adminLogin,
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
