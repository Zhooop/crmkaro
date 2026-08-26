# Staging Deployment Specification

CRMKaro staging mirrors production boundaries while using isolated, non-production accounts and synthetic data.

## Required services

- Node.js 24 runtime for web, admin, API and worker processes
- PostgreSQL 17 with separate owner and restricted application roles
- Redis 8 for queues, rate-limit coordination and transient work
- TLS-terminating load balancer or managed application gateway
- Encrypted object storage for backups and generated documents when persistence is enabled
- Transactional email sandbox and separate Google OAuth client

## Public routing

- `app.staging.example.com` → web application
- `admin.staging.example.com` → isolated admin application
- `api.staging.example.com` → API `/api/v1`

Set `WEB_URL`, `ADMIN_URL`, Google callback URLs and CORS origins to these exact HTTPS origins. The admin hostname must have an additional identity-aware access policy.

## Release procedure

1. Provision services and secrets from the environment contract in `.env.example`.
2. Build immutable artifacts with `pnpm install --frozen-lockfile && pnpm build`.
3. Run `pnpm db:deploy` once using the database-owner connection.
4. Start API and worker with the restricted application database connection.
5. Start web/admin with `NEXT_PUBLIC_API_URL=https://api.staging.example.com/api/v1`.
6. Execute the release checklist and connected MVP smoke scenario using synthetic records.

No production customer data may be copied into staging. A hosting-specific deployment manifest should be added only after the hosting provider and regions are approved.
