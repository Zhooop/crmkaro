# CRMKaro API

## Authentication endpoints

```text
POST /api/v1/auth/email/request-otp
POST /api/v1/auth/email/verify-otp
GET  /api/v1/auth/google/start
GET  /api/v1/auth/google/callback
GET  /api/v1/auth/me
POST /api/v1/auth/logout
```

Authentication uses a random opaque session token stored in an `HttpOnly`, `SameSite=Lax` cookie. Only its SHA-256 hash is persisted.

Email OTP delivery uses SMTP when configured. In non-production environments without SMTP, the request response includes `developmentCode`; production refuses email authentication when SMTP is unavailable.

Google OAuth requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI`.

## Organisation endpoints

```text
POST /api/v1/organisations
GET  /api/v1/organisations
POST /api/v1/organisations/:organisationId/activate
```

Organisation creation atomically creates the owner role, owner membership, selected service entitlements and audit event. The active organisation is stored in the authenticated session.

