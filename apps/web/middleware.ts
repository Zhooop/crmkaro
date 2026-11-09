import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = [
  "/",
  "/people",
  "/groups",
  "/quick-collect",
  "/transactions",
  "/students",
  "/crm",
  "/finance",
  "/payroll",
  "/inventory",
  "/settings",
];

const AUTH_ROUTES = ["/login", "/register"];

const KNOWN_PUBLIC_PAGES = [
  "/",
  "/landing",
  "/about",
  "/blog",
  "/features",
  "/terms",
  "/terms-and-conditions",
  "/privacy",
  "/privacy-policy",
  "/refund",
  "/refund-policy",
  "/pay",
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const urlToken = request.nextUrl.searchParams.get("token") || undefined;
  const sessionToken = request.cookies.get("crm_session")?.value || urlToken;

  // Extract host without port (e.g. 'crmkaro.com', 'web.crmkaro.com', 'localhost')
  const rawHost = request.headers.get("host") || "";
  const host = (rawHost.toLowerCase().split(":")[0] || "").trim();
  const isMarketingDomain = host === "crmkaro.com" || host === "www.crmkaro.com";
  const isWebPortalDomain =
    host === "web.crmkaro.com" ||
    host === "app.crmkaro.com" ||
    host.startsWith("web.") ||
    host.startsWith("app.");
  const isSecure = process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:";

  // =========================================================================
  // 1. MARKETING DOMAIN (crmkaro.com & www.crmkaro.com)
  // =========================================================================
  if (isMarketingDomain) {
    // Root URL on marketing domain -> cleanly serve the Landing Page
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/landing", request.url));
    }

    // Auth routes on marketing domain -> redirect to web portal login
    if (pathname === "/login" || pathname === "/register") {
      return NextResponse.redirect(new URL(`https://web.crmkaro.com${pathname}${search}`));
    }

    // Protected app routes on marketing domain -> redirect to web portal
    const isAppRoute = PROTECTED_ROUTES.some(
      (route) => route !== "/" && (pathname === route || pathname.startsWith(`${route}/`)),
    );
    if (isAppRoute) {
      return NextResponse.redirect(new URL(`https://web.crmkaro.com${pathname}${search}`));
    }

    // Known static / public marketing pages (including legal & payment checkout)
    const isKnownPublicPage = KNOWN_PUBLIC_PAGES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    if (isKnownPublicPage) {
      return NextResponse.next();
    }

    // Any other broken / unknown links on crmkaro.com -> redirect to root landing page
    return NextResponse.redirect(new URL("https://crmkaro.com/"));
  }

  // =========================================================================
  // 2. WEB PORTAL DOMAIN (web.crmkaro.com / app.crmkaro.com)
  // =========================================================================
  if (isWebPortalDomain) {
    // Landing page route accessed on web portal -> redirect to marketing domain
    if (pathname === "/landing") {
      return NextResponse.redirect(new URL("https://crmkaro.com/"));
    }

    // Public payment links or legal pages accessed on web portal
    const isPublicPage = KNOWN_PUBLIC_PAGES.some(
      (route) => route !== "/" && (pathname === route || pathname.startsWith(`${route}/`)),
    );
    if (isPublicPage) {
      return NextResponse.next();
    }

    // Unauthenticated access to root dashboard or protected routes
    const isProtected =
      pathname === "/" ||
      PROTECTED_ROUTES.some(
        (route) => route !== "/" && (pathname === route || pathname.startsWith(`${route}/`)),
      );

    if (isProtected && !sessionToken) {
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("redirect", `${pathname}${search}`);
      }
      return NextResponse.redirect(loginUrl);
    }

    const response = NextResponse.next();
    if (urlToken) {
      response.cookies.set("crm_session", urlToken, {
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
        sameSite: "lax",
        secure: isSecure,
      });
    }
    return response;
  }

  // =========================================================================
  // 3. LOCAL DEVELOPMENT / DIRECT IP ACCESS (e.g. localhost:3200)
  // =========================================================================
  // Public pages (payment, legal, etc.)
  const isPublicPage = KNOWN_PUBLIC_PAGES.some(
    (route) => route !== "/" && (pathname === route || pathname.startsWith(`${route}/`)),
  );
  if (isPublicPage) {
    return NextResponse.next();
  }

  // If at root and unauthenticated -> rewrite to Landing Page
  if (pathname === "/" && !sessionToken) {
    return NextResponse.rewrite(new URL("/landing", request.url));
  }

  // If at root and authenticated -> proceed to Dashboard
  if (pathname === "/" && sessionToken) {
    const response = NextResponse.next();
    if (urlToken) {
      response.cookies.set("crm_session", urlToken, {
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
        sameSite: "lax",
        secure: isSecure,
      });
    }
    return response;
  }

  // Protected routes require authentication
  const isProtected = PROTECTED_ROUTES.some(
    (route) => route !== "/" && (pathname === route || pathname.startsWith(`${route}/`)),
  );
  if (isProtected && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  if (urlToken) {
    response.cookies.set("crm_session", urlToken, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      secure: isSecure,
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|brand|landing/|favicon.ico|favicon.png|icon.png).*)",
  ],
};
