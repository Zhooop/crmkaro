export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "crmkaro.com" ||
      window.location.hostname.endsWith(".crmkaro.com"))
  ) {
    return "https://api.crmkaro.com/api/v1";
  }
  return "http://localhost:4000/api/v1";
}

export function authHeaders(extraHeaders?: HeadersInit): HeadersInit {
  const headers = new Headers(extraHeaders);
  if (typeof window !== "undefined") {
    const token =
      localStorage.getItem("crmkaro_admin_token") ||
      localStorage.getItem("crmkaro_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return headers;
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = authHeaders(init?.headers);
  return fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });
}
