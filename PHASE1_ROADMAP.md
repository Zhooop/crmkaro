# CRMKaro — Phase 1 Roadmap

## Status legend

- `[ ]` Pending
- `[~]` In progress
- `[x]` Complete

## 1. Repository and monorepo foundation `[x]`

- Initialise and connect the approved GitHub repository
- Configure the personal Git identity
- Create pnpm/Turborepo workspace
- Scaffold web, admin, API and worker applications
- Add shared packages and baseline tooling
- Add environment contract and project documentation
- Verify install, typecheck and builds

## 2. Local infrastructure and database foundation `[x]`

- PostgreSQL and Redis development setup
- Prisma configuration and initial migration
- Core organisation and identity tables
- Tenant context and Row-Level Security foundation
- Seed data and database test helpers

## 3. Authentication and organisation tenancy `[x]`

- Email OTP and Google OAuth foundations
- Secure cookie sessions
- Organisation onboarding
- Memberships and active-organisation switching
- Login security, rate limiting and session revocation

## 4. Permissions, entitlements and audit `[x]`

- Permission catalogue and fixed role presets
- Backend guards and policy checks
- Organisation service entitlements
- Audit event model and append-only logging
- Cross-tenant security test suite

## 5. Client and Super Admin shells `[x]`

- CRM workspace navigation and responsive shell
- Super Admin shell and real platform API data integration
- Design tokens, reusable UI components and accessibility baseline
- Dashboard framework, global search command palette (`⌘ K`), Quick Add and notifications

## 6. Shared People module `[x]`

- People schema, CRUD, archive and duplicate detection
- Person types and tags
- Profile and activity timeline
- CSV import/export with permission checks

## 7. Leads and CRM `[x]`

- Pipelines and configurable stages
- Lead list and interactive Kanban board views
- Assignment, follow-ups, notes and activity
- Transactional lead-to-customer conversion
- CRM dashboard metrics

## 8. Finance, invoices and payments `[x]`

- Invoices and itemized line items builder
- Partial/final payments, receipts and dues tracking
- Expenses, refunds and financial audit trail
- PDF generation and download

## 9. Payroll and inventory `[x]`

- Employees and salary structures
- Monthly payroll, approval, payment and salary slips PDF
- Products, categories and stock movements ledger
- Low-stock alerts and valuation metrics

## 10. Release QA & Live Deployment `[x]`

- Role-aware dashboards and notifications
- Connected MVP end-to-end user journeys
- Full monorepo typecheck & production build verification
- Live Hostinger VPS deployment synchronization
