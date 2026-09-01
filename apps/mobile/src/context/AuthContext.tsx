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
  logout: () => Promise<void>;
  switchOrganisation: (org: Organisation) => Promise<void>;
  refreshContext: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

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

      // Fetch user profile
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

  async function login(email: string, password: string) {
    const res = await apiFetch<{ token?: string; user?: User; accessToken?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (res.error || !res.data) {
      return { success: false, error: res.error || "Login failed. Invalid credentials." };
    }

    const token = res.data.token || res.data.accessToken;
    if (token) {
      await setAuthToken(token);
      await loadUserSession();
      return { success: true };
    }

    return { success: false, error: "Authentication token missing." };
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {}
    await removeAuthToken();
    setUser(null);
    setActiveOrg(null);
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
