import AsyncStorage from "@react-native-async-storage/async-storage";

// Default to production API if not configured, or localhost for local testing
export const API_BASE_URL = "https://api.crmkaro.com";

const AUTH_TOKEN_KEY = "@crmkaro_token";
const ACTIVE_ORG_KEY = "@crmkaro_active_org";

export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {}
}

export async function removeAuthToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
  } catch {}
}

export async function getActiveOrgId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_ORG_KEY);
  } catch {
    return null;
  }
}

export async function setActiveOrgId(orgId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_ORG_KEY, orgId);
  } catch {}
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const token = await getAuthToken();
  const orgId = await getActiveOrgId();

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (orgId) {
    headers["x-organisation-id"] = orgId;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const status = res.status;

    if (status === 204) {
      return { data: null, error: null, status };
    }

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { message: text };
    }

    if (!res.ok) {
      return {
        data: null,
        error: json?.message || `Request failed with status ${status}`,
        status,
      };
    }

    return { data: json, error: null, status };
  } catch (err: any) {
    return {
      data: null,
      error: err?.message || "Network request failed. Please check internet connection.",
      status: 0,
    };
  }
}
