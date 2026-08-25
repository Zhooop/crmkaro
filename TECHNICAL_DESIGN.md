# CRMKaro — Technical Design

## 1. Status

This document records the approved technical direction for the CRMKaro MVP. Implementation-level details may evolve through migrations and architecture decision records, but the boundaries and principles below are considered locked unless a product requirement changes.

## 2. Architecture

CRMKaro will begin as a **modular monolith** in a TypeScript monorepo.

```text
Client Web App ──────┐
                    ├── REST API ── PostgreSQL
Super Admin App ────┘       │
                            ├── Redis / Job Queue
                            └── S3-compatible Storage
```

Microservices are deferred until demonstrated operational need exists, such as independent scaling, separate team ownership or strict deployment isolation.

### Applications

```text
apps/
├── web/       Organisation workspace — Next.js
├── admin/     CRMKaro Super Admin — Next.js
├── api/       Shared modular backend — NestJS
└── worker/    Background jobs — NestJS/BullMQ
```

### Shared packages

```text
packages/
├── database/       Prisma schema, migrations and database client
├── contracts/      Request/response schemas and shared types
├── permissions/    Permission catalogue and role presets
├── ui/             Shared design-system components
├── config/         TypeScript, linting and build configuration
└── observability/  Logging, tracing and error-reporting helpers
```

## 3. Approved Technology Stack

| Concern | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Client frontend | Next.js App Router + TypeScript |
| Super Admin frontend | Separate Next.js App Router application |
| UI | Tailwind CSS + shadcn/ui primitives |
| Forms | React Hook Form + Zod |
| Server state | TanStack Query where client caching is required |
| Backend | NestJS modular monolith |
| API | REST, JSON and OpenAPI |
| Database | PostgreSQL |
| ORM/migrations | Prisma, with SQL migrations for RLS and specialised constraints |
| Queue/cache | Redis + BullMQ |
| Files | Private S3-compatible object storage |
| Authentication | Google OAuth + email OTP; secure cookie sessions |
| PDF output | Server-rendered HTML to PDF |
| Unit/integration tests | Vitest/Jest |
| Browser tests | Playwright |
| Packaging | Docker |
| Error monitoring | Sentry-compatible error reporting |
| Logs | Structured JSON logs with request correlation IDs |

Exact dependency versions will be pinned at project setup after checking current stable releases.

## 4. Backend Module Boundaries

```text
Core
├── Auth
├── Users
├── Organisations
├── Memberships
├── RolesPermissions
├── ServicesEntitlements
├── Notifications
├── Audit
└── Files

Business
├── People
├── CRM
├── Finance
├── Payroll
└── Inventory

Platform
├── SuperAdmin
├── Plans
└── Subscriptions
```

Rules:

- A module owns its tables and write operations.
- Other modules consume its public service interface or domain events.
- Cross-module database writes are not allowed from controllers.
- Multi-record business operations use database transactions.
- Background jobs must be idempotent and safe to retry.
- Public API DTOs do not expose database models directly.

## 5. Multi-Tenant Model

One shared PostgreSQL database will contain all organisations. Every tenant-owned row must include `organisation_id`.

Tenant protection layers:

1. Active organisation is selected explicitly in the authenticated session.
2. Membership is verified for every request.
3. Repository/database calls require organisation context.
4. PostgreSQL Row-Level Security restricts tenant-owned rows.
5. Cross-tenant integration tests attempt horizontal access attacks.

The normal application database role must not own tenant tables and must not have `BYPASSRLS`.

## 6. Core Database Schema

All primary identifiers use UUIDs. Timestamps are stored in UTC. Money is stored as integer minor units or fixed-precision decimal according to the field contract; floating-point types are prohibited for financial values.

Common tenant-owned fields:

```text
id
organisation_id
created_at
updated_at
created_by
updated_by
```

### 6.1 Identity and organisations

```text
users
├── id
├── email
├── name
├── avatar_url
├── status
├── mfa_enabled
├── last_login_at
└── timestamps

organisations
├── id
├── name
├── slug
├── business_type
├── industry
├── timezone
├── currency
├── status
└── timestamps

organisation_memberships
├── id
├── organisation_id
├── user_id
├── role_id
├── status
├── invited_by
├── invited_at
├── joined_at
└── timestamps

roles
├── id
├── organisation_id nullable for system presets
├── code
├── name
├── is_system
└── timestamps

permissions
├── id
├── code unique
├── module
└── description

role_permissions
├── role_id
└── permission_id
```

Unique constraints:

- `users.email`
- `organisations.slug`
- `(organisation_id, user_id)` on memberships
- `(organisation_id, code)` on organisation roles
- `permissions.code`

### 6.2 Services and subscriptions

```text
services
├── id
├── code
├── name
├── status
└── sort_order

features
├── id
├── service_id
├── code
└── name

organisation_services
├── id
├── organisation_id
├── service_id
├── status
├── activated_at
├── disabled_at
└── configuration_json

plans
plan_entitlements
subscriptions
subscription_items
```

Service access is derived from active organisation entitlements, not from sidebar visibility.

### 6.3 People

```text
people
├── id
├── organisation_id
├── display_name
├── primary_phone
├── alternate_phone
├── email
├── address_json
├── status
├── notes
├── archived_at
└── timestamps

person_types
├── person_id
└── type: CUSTOMER | STUDENT | MEMBER | EMPLOYEE

tags
person_tags
```

Normalised phone/email columns will support duplicate detection without changing display formatting.

### 6.4 CRM

```text
pipelines
pipeline_stages

leads
├── id
├── organisation_id
├── person_id nullable
├── pipeline_id
├── stage_id
├── owner_membership_id
├── name
├── phone
├── email
├── source
├── expected_value
├── status
├── lost_reason
├── converted_at
└── timestamps

follow_ups
├── id
├── organisation_id
├── lead_id
├── assigned_to
├── due_at
├── status
├── outcome
└── completed_at

lead_notes
lead_activities
```

Lead conversion runs in one transaction and creates or links a Person record.

### 6.5 Finance

```text
invoices
├── id
├── organisation_id
├── person_id
├── invoice_number
├── issue_date
├── due_date
├── status
├── subtotal
├── discount_total
├── tax_total
├── grand_total
├── paid_total
├── balance_due
└── timestamps

invoice_items
├── invoice_id
├── description
├── quantity
├── unit_price
├── discount
├── tax_rate
└── line_total

payments
├── id
├── organisation_id
├── person_id
├── invoice_id nullable
├── payment_number
├── amount
├── method
├── paid_at
├── reference
├── status
└── reversal_of_id nullable

expenses
expense_categories
refunds
```

Posted payments are corrected using reversal/adjustment entries rather than destructive edits.

### 6.6 Payroll

```text
employees
├── id
├── organisation_id
├── person_id unique per organisation
├── employee_code
├── department
├── designation
├── joining_date
├── employment_status
└── payout_details_encrypted

salary_structures
salary_components
employee_salary_components

payroll_runs
├── id
├── organisation_id
├── month
├── year
├── status
├── approved_by
├── approved_at
└── totals

payroll_items
├── payroll_run_id
├── employee_id
├── gross_amount
├── deduction_amount
├── net_amount
├── payment_status
├── paid_at
└── immutable_snapshot_json
```

Approved payroll items preserve a snapshot of the salary calculation used for that month.

### 6.7 Inventory

```text
products
├── id
├── organisation_id
├── name
├── sku
├── category_id
├── unit
├── selling_price
├── cost_price
├── low_stock_threshold
├── status
└── timestamps

product_categories

stock_movements
├── id
├── organisation_id
├── product_id
├── type: OPENING | IN | OUT | ADJUSTMENT
├── quantity_delta
├── unit_cost
├── reason
├── reference_type
├── reference_id
└── occurred_at
```

Stock movement is the source of truth. Current stock may be cached for speed, but it must remain reconcilable from movements.

### 6.8 Platform operations

```text
notifications
audit_logs
file_objects
outbox_events
idempotency_keys
job_failures
```

Audit logs contain actor, organisation, action, entity, entity ID, safe change summary, timestamp, request ID and source metadata. Secrets and unnecessary personal data are excluded.

## 7. Permission Matrix

Permission codes follow `module.resource.action`, for example `crm.lead.create`.

Legend: `F` full, `A` assigned/own records, `V` view only, `—` denied.

| Capability | Owner | Admin | Sales | Accountant | HR | Staff |
|---|---:|---:|---:|---:|---:|---:|
| Organisation settings | F | V/Edit operational | — | — | — | — |
| Team invitations | F | F | — | — | — | — |
| Services and subscription | F | V | — | — | — | — |
| People records | F | F | A | V | V employee | V limited |
| Import/export People | F | F | — | Export if granted | — | — |
| Leads | F | F | A | V | — | — |
| Pipeline configuration | F | F | — | — | — | — |
| Invoices | F | F | V | F | — | — |
| Payments/refunds | F | F | V | F | — | — |
| Expenses | F | F | — | F | — | — |
| Employee profiles | F | F | — | V limited | F | — |
| Salary structures | F | F | — | V limited | F | — |
| Payroll approval | F | If granted | — | — | Prepare | — |
| Mark salary paid | F | If granted | — | F | V | — |
| Products | F | F | V | V | — | V |
| Stock movements | F | F | — | V | — | F |
| Audit logs | F | V scoped | — | V finance | V payroll | — |

Sensitive permissions are always explicit:

- `people.export`
- `finance.payment.refund`
- `payroll.salary.view`
- `payroll.run.approve`
- `inventory.negative_stock.override`
- `organisation.member.manage`
- `organisation.service.manage`

The backend permission catalogue is authoritative. UI checks only improve usability.

## 8. API Design

### 8.1 Conventions

- Base path: `/api/v1`
- JSON request and response bodies
- Resource-oriented plural endpoints
- UUID resource identifiers
- ISO 8601 UTC timestamps
- Cursor pagination for activity feeds; page pagination for administrative tables
- Filter and sort allowlists
- Consistent error envelope
- Idempotency keys for payment, payroll approval and stock-write operations
- Optimistic concurrency/version field for sensitive edits where needed

### 8.2 Organisation context

The active organisation is carried through a validated route/header context and must match an authenticated membership. It is never accepted as trustworthy merely because the client supplied it.

Example endpoint groups:

```text
/api/v1/auth/*
/api/v1/organisations/*
/api/v1/people/*
/api/v1/crm/leads/*
/api/v1/crm/follow-ups/*
/api/v1/finance/invoices/*
/api/v1/finance/payments/*
/api/v1/finance/expenses/*
/api/v1/payroll/employees/*
/api/v1/payroll/runs/*
/api/v1/inventory/products/*
/api/v1/inventory/stock-movements/*
/api/v1/notifications/*
/api/v1/admin/*
```

### 8.3 Response shape

```json
{
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

Validation/error shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields need attention.",
    "fields": {},
    "requestId": "uuid"
  }
}
```

### 8.4 Business commands

Actions with meaningful domain behaviour use explicit command endpoints:

```text
POST /crm/leads/:id/convert
POST /finance/payments/:id/reverse
POST /payroll/runs/:id/approve
POST /payroll/runs/:id/mark-paid
POST /inventory/products/:id/adjust-stock
POST /organisations/:id/services/:serviceCode/enable
```

### 8.5 Events and jobs

An outbox table guarantees that committed business events are eventually processed.

Initial events:

- `LeadConverted`
- `FollowUpDue`
- `InvoiceIssued`
- `PaymentRecorded`
- `PayrollApproved`
- `SalaryMarkedPaid`
- `StockThresholdCrossed`
- `ServiceEnabled`

## 9. UI/UX Design System

### 9.1 Psychological direction

The interface must communicate trust, control, clarity and calm. It should avoid visually aggressive sales-dashboard styling.

### 9.2 Colour system

Recommended light theme tokens:

```text
Primary / Trust Blue       #2563EB
Primary Hover              #1D4ED8
Primary Soft               #EFF6FF

Success / Teal             #0F766E
Success Soft               #F0FDFA

Warning / Amber            #D97706
Warning Soft               #FFFBEB

Danger / Red               #DC2626
Danger Soft                #FEF2F2

App Background             #F8FAFC
Surface                    #FFFFFF
Border                     #E2E8F0
Primary Text               #0F172A
Secondary Text             #475569
Muted Text                 #64748B
```

Rules:

- Blue is used for navigation, focus and primary actions.
- Teal/green indicates completed or healthy states, not general decoration.
- Amber is reserved for pending or attention-required states.
- Red is reserved for destructive, overdue or failed states.
- Financial values do not use red/green as the only meaning indicator.
- Colour contrast must meet WCAG AA targets.

### 9.3 Typography and density

- Font: Inter or a comparable highly legible sans-serif
- Base text: 14–16 px depending on context
- Tables use compact but comfortable row density
- Monetary values use tabular numerals
- Headings remain restrained; hierarchy comes from size, weight and spacing

### 9.4 Layout

Desktop:

```text
Persistent sidebar + top bar + page workspace
```

Tablet:

```text
Collapsible sidebar + top bar
```

Mobile:

```text
Top bar + contextual bottom navigation + card/list transformations
```

### 9.5 Core page pattern

```text
Breadcrumb / Context
Page title + description               Primary action
Summary metrics (only when useful)
Search + filters + saved view controls
Table / Kanban / workflow content
Pagination or progressive loading
```

### 9.6 Interaction rules

- One clear primary action per screen
- Destructive actions require explicit confirmation
- Create/edit uses drawers for short forms and pages for complex workflows
- Forms show required essentials first and optional sections progressively
- Filters persist during the user's session
- Empty states explain the next useful action
- Loading uses skeletons; background actions use non-blocking status indicators
- Tables remain keyboard accessible
- Permission-denied actions are hidden when irrelevant and explained when contextually expected
- Mobile tables convert to purpose-built cards rather than horizontal squeezing

## 10. Security Architecture

- Secure cookie-based sessions
- Google OAuth and email OTP
- Mandatory Super Admin MFA; privileged organisation accounts require MFA
- TLS everywhere
- Encryption at rest and application-level encryption for selected sensitive fields
- KMS-managed encryption keys
- Strict CORS and Content Security Policy
- CSRF protection for cookie-authenticated mutations
- Request validation and output encoding
- Per-IP and per-account rate limiting
- Private file storage with short-lived signed URLs
- Audit logging for sensitive operations
- Dependency and secret scanning in CI
- Encrypted backups and restore tests

Pure end-to-end encryption is explicitly not part of the architecture.

## 11. Testing Strategy

### Unit tests

- Domain rules
- Calculations
- Permission decisions
- Validation

### Integration tests

- Database transactions
- Row-Level Security
- Module boundaries
- Job idempotency

### End-to-end tests

- Organisation onboarding
- Lead conversion
- Invoice and partial/final payment
- Payroll generation and approval
- Stock-in/out and low-stock notification
- Role restrictions

### Mandatory security suite

For every tenant resource, Organisation A must be unable to read, modify, export or reference Organisation B's data using list endpoints, direct IDs, nested relationships, imports or background jobs.

## 12. Deployment and Operations

Environments:

```text
Local → Staging → Production
```

Production components:

- Web container
- Admin container
- API container
- Worker container
- Managed PostgreSQL
- Managed Redis
- Private object storage
- CDN/WAF at the edge

Operational requirements:

- Controlled database migrations
- Health and readiness endpoints
- Central structured logs
- Error monitoring and alerting
- Database performance metrics
- Queue depth and failed-job alerts
- Automated encrypted backups
- Regular restore drills
- No permanent developer production access

## 13. Implementation Order

1. Monorepo, CI and local infrastructure
2. Database, authentication and organisation context
3. Permissions, service entitlements and audit foundation
4. Client and Super Admin application shells
5. Shared People module
6. CRM and follow-ups
7. Finance and payments
8. Payroll
9. Inventory
10. Notifications, dashboards and reports
11. Import/export and PDF outputs
12. Security hardening and connected MVP acceptance testing

## 14. Locked Technical Decisions

- TypeScript monorepo
- Separate client and Super Admin frontends
- Shared NestJS modular backend
- PostgreSQL with tenant IDs and Row-Level Security
- Prisma plus reviewed SQL migrations
- REST API with OpenAPI contracts
- Redis/BullMQ for asynchronous work
- S3-compatible private file storage
- Fixed MVP roles backed by granular permissions
- Blue/teal/slate accessible design system
- Modular monolith before microservices
- Audit-first financial, payroll and stock operations

