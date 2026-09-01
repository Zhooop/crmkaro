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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get("crm_session")?.value;

  // Check if current path is a protected route
  const isProtected =
    pathname === "/" ||
    PROTECTED_ROUTES.some(
      (route) => route !== "/" && (pathname === route || pathname.startsWith(`${route}/`)),
    );

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // If unauthenticated user tries to access protected route -> instant 0ms server redirect to /login
  if (isProtected && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user visits login or register -> redirect to dashboard
  if (isAuthRoute && sessionToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api
     * - _next/static
     * - _next/image
     * - brand, favicon.ico, icon.png, favicon.png
     */
    "/((?!api|_next/static|_next/image|brand|favicon.ico|favicon.png|icon.png).*)",
  ],
};
