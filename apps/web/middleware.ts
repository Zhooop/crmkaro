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

const KNOWN_MARKETING_PAGES = [
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
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionToken = request.cookies.get("crm_session")?.value;

  // Extract host without port (e.g. 'crmkaro.com', 'web.crmkaro.com', 'localhost')
  const rawHost = request.headers.get("host") || "";
  const host = (rawHost.toLowerCase().split(":")[0] || "").trim();
  const isMarketingDomain = host === "crmkaro.com" || host === "www.crmkaro.com";
  const isWebPortalDomain =
    host === "web.crmkaro.com" ||
    host === "app.crmkaro.com" ||
    host.startsWith("web.") ||
    host.startsWith("app.");

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

    // Known static / marketing pages
    const isKnownPublicPage = KNOWN_MARKETING_PAGES.some(
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

    // Authenticated user visits login/register -> redirect to dashboard
    const isAuthRoute = AUTH_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    if (isAuthRoute && sessionToken) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  // =========================================================================
  // 3. LOCAL DEVELOPMENT / DIRECT IP ACCESS (e.g. localhost:3200)
  // =========================================================================
  // If at root and unauthenticated -> rewrite to Landing Page
  if (pathname === "/" && !sessionToken) {
    return NextResponse.rewrite(new URL("/landing", request.url));
  }

  // If at root and authenticated -> proceed to Dashboard
  if (pathname === "/" && sessionToken) {
    return NextResponse.next();
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

  // Auth routes when already authenticated
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (isAuthRoute && sessionToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|brand|landing/|favicon.ico|favicon.png|icon.png).*)",
  ],
};
