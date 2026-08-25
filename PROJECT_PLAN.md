# CRMKaro — Product & Architecture Plan

## 1. Product Vision

CRMKaro ko sirf ek traditional CRM dashboard nahi, balki ek modular **Business Operating System** ke roop mein build karna hai.

Platform ka objective hai ki different types ke organisations apni zarurat ke hisaab se services select karke ek hi workspace se business operate kar saken.

Core experience:

- Simple, clean, fast aur professional
- Desktop-first, fully responsive
- Role-aware and organisation-aware
- Modular services without unnecessary clutter
- Configuration-driven instead of industry-specific hardcoding
- New organisation ko approximately 5 minutes mein kaam start karwana

## 2. Product Principles

### 2.1 Modular by design

Har organisation sirf wahi services dekhe aur use kare jo uske plan ya subscription mein enabled hain.

Example:

```text
CRM        Enabled
People     Enabled
Finance    Enabled
HR         Disabled
Inventory  Enabled
```

Is organisation ke sidebar aur APIs mein HR available nahi hoga.

### 2.2 Shared foundation

Common business entities ko duplicate nahi karna hai. `People` ek shared foundation hoga jise different services extend karengi.

```text
Person
├── Student
├── Member
├── Customer
└── Employee
```

Ek hi person multiple business contexts ya roles rakh sakta hai.

### 2.3 Progressive disclosure

User ko ek saath giant forms aur unnecessary settings nahi dikhani hain. Pehle required fields, phir optional details.

### 2.4 Role-aware experience

Owner, salesperson, accountant, HR user aur staff ko same dashboard ya same actions nahi dikhne chahiye.

### 2.5 Data safety

Service disable hone par business data delete nahi hoga. Data preserved rahega aur service reactivate hone par wapas accessible hoga.

## 3. Target Organisation Types

Platform generic rahega aur kisi single industry mein lock nahi hoga. Initial organisation categories:

- Education
- Fitness
- Healthcare
- Retail
- Professional Services
- NGO
- Corporate
- Other

Business type ka use recommendations aur default configuration ke liye hoga, application logic ko hardcode karne ke liye nahi.

## 4. Platform Hierarchy

```text
Platform
└── Organisation
    ├── Subscription
    ├── Workspace
    ├── Services
    │   └── Features
    ├── Entitlements
    ├── People
    ├── Roles
    ├── Permissions
    └── Users
```

Core separation:

- **Platform level:** CRMKaro super admin operations
- **Organisation level:** client business, subscription and enabled services
- **Workspace level:** day-to-day operations by organisation users

## 5. Planned Services

### Initial services

- CRM
- People
- Finance
- HR & Payroll
- Inventory
- Reports / Analytics

### Possible future services

- Attendance
- Communication
- Appointments
- Helpdesk
- Assets
- Projects
- Marketing
- Documents
- AI assistance

## 6. Service and Feature Architecture

Service activation ko simple boolean UI toggle tak limited nahi rakhna hai. Recommended access chain:

```text
Organisation
↓
Subscription
↓
Entitlements
↓
Services
↓
Features
↓
Roles and Permissions
↓
UI and API access
```

Example HR service structure:

```text
HR & Payroll
├── Employee Management
├── Attendance
├── Leave
├── Payroll
└── Salary Slips
```

Initially all HR features ek package mein ho sakte hain. Future mein granular plans possible hone chahiye:

```text
HR Basic: Employees + Attendance
HR Pro:   Employees + Attendance + Leave + Payroll
```

## 7. Service Lifecycle

Recommended lifecycle:

```text
Available
↓
Trial / Pending
↓
Active
↓
Disabled
↓
Active
```

### Adding a service later

Organisation owner ka expected flow:

```text
Settings
↓
Services
↓
Available Services
↓
Select Service
↓
Review Price and Activation Date
↓
Enable Service
↓
Minimum Configuration
↓
Service appears in workspace
```

Service activation ke baad:

- Organisation entitlement update hoga
- Required default settings create hongi
- Sidebar automatically update hoga
- Relevant role permissions configure hongi
- Backend APIs access allow karengi
- Existing shared data reuse kiya jayega

### Disabling a service

```text
Active → Disabled
```

- UI navigation hidden rahega
- Backend API access blocked rahega
- Existing data preserved rahega
- Reactivation par purana data restore hoga
- Permanent deletion alag, deliberate administrative process hoga

## 8. Suggested Core Data Model

Conceptual entities:

```text
users
organisations
organisation_memberships
subscriptions
plans
services
features
plan_entitlements
organisation_services
roles
permissions
role_permissions
people
person_roles
audit_logs
```

`organisation_services` ke possible fields:

```text
id
organisation_id
service_id
status
activated_at
disabled_at
trial_ends_at
configuration
subscription_item_id
```

Every organisation-scoped record mein tenant isolation enforce karna mandatory hoga.

## 9. Backend Enforcement

Frontend par service hide karna sufficient nahi hai. Har protected API request ke liye backend validate karega:

1. User authenticated hai?
2. User organisation ka member hai?
3. Organisation ke paas requested service/feature entitlement hai?
4. User ke role ke paas requested action ki permission hai?
5. Requested record isi organisation ka hai?

Example:

```text
POST /api/hr/employees
↓
HR service enabled?
├── No  → 403 Service not enabled
└── Yes → Permission check → Process request
```

## 10. First-Time User Flow

Two primary onboarding paths honge:

1. Organisation Owner / Admin
2. Invited Staff / User

### 10.1 Owner onboarding

```text
Open application URL
↓
Welcome / Login
↓
Authentication
↓
New user or organisation membership check
↓
Create Organisation
↓
Business Information
↓
Select Services
↓
Basic Service Configuration
↓
Invite Team / Import Data (optional)
↓
Role-aware Dashboard
```

Onboarding ko approximately five major steps mein present karna hai:

1. Account
2. Organisation
3. Services
4. Basic Configuration
5. Team / Data

Optional steps mein **Skip** ya **Do later** available hona chahiye.

### 10.2 Authentication

Initial options:

- Continue with Google
- Email OTP / passwordless login

Authentication ke baad backend check:

```text
User exists?
├── No  → Owner onboarding or invitation flow
└── Yes
    └── Organisation membership exists?
        ├── Yes → Workspace
        └── No  → Invitation or organisation setup
```

### 10.3 Organisation information

Minimum fields:

- Organisation name
- Business type
- Industry
- Phone
- Email
- City

### 10.4 Service selection

Service cards clear benefit-oriented descriptions ke saath show hongi:

- CRM — leads and follow-ups
- People — students, members and customers
- Finance — payments, invoices and expenses
- HR — employees and salary
- Inventory — products and stock

Industry ke basis par recommended setup suggest kiya ja sakta hai, lekin user confirmation ke bina services automatically activate nahi hongi.

Example:

```text
Education recommendation
✓ CRM
✓ People
✓ Finance
✓ Attendance

[Use Recommended Setup] [Customize]
```

### 10.5 Basic service configuration

Sirf minimum required settings onboarding mein hongi.

Finance example:

- Currency
- Payment methods
- Invoice prefix
- Receipt prefix

CRM example:

- Lead stages: New, Contacted, Interested, Follow-up, Converted, Lost

People example:

- Person types: Students, Members, Customers

Advanced settings baad mein `Settings → Services` mein configure hongi.

### 10.6 Team invitation

Optional and skippable step:

- Email address
- Role
- Add another member
- Send invitations

Initial roles:

- Admin
- Manager
- Sales
- Accountant
- HR
- Staff
- Custom Role

### 10.7 Data setup

User ko three choices:

- Add manually
- Import Excel / CSV
- Start with empty workspace

Import workflow:

```text
Upload file
↓
Detect records and columns
↓
Map source columns
↓
Validate data
↓
Show import summary
↓
Confirm import
```

### 10.8 Existing user flow

```text
Open URL → Login → Organisation identified → Dashboard
```

Completed onboarding repeat nahi hoga.

### 10.9 Invited employee flow

```text
Invitation link
↓
Organisation invitation details
↓
Login / Create account
↓
Accept invitation
↓
Basic profile setup
↓
Role and permissions loaded
↓
Employee dashboard
```

Invited user ko organisation creation onboarding nahi dikhana hai.

## 11. UI/UX Direction

Recommended visual direction:

- Modern SaaS + enterprise dashboard
- Neutral base with one strong brand accent
- Light theme initially
- Dark theme later
- Premium but minimal
- Information-dense without feeling cluttered
- Consistent page headers, filters, tables and actions

Responsive navigation:

- Desktop: sidebar + top bar
- Tablet: collapsible sidebar
- Mobile: top bar + bottom navigation

Har screen par user ko instantly samajh aana chahiye:

1. Main kya dekh raha hoon?
2. Main yahan kya kar sakta hoon?
3. Next action kya hai?

## 12. Navigation Structure

Activated services hi sidebar mein appear hongi.

```text
Workspace
├── Dashboard
└── Inbox / Notifications

Services
├── CRM
├── People
├── Finance
├── HR
└── Inventory

Insights
├── Reports
└── Analytics

System
├── Settings
└── Help
```

## 13. Global Search

Top bar mein global search with `Ctrl/Cmd + K`:

```text
Search: Rahul

People
└── Rahul Sharma · Student

Leads
└── Rahul Sharma · Follow-up tomorrow

Payments
└── Rahul Sharma · ₹5,000 · 24 Aug 2026
```

Search result permissions aur enabled services respect karega.

## 14. Role-Aware Dashboard

### Owner

- Revenue
- Pending payments
- New leads
- Conversions
- Active members
- Expenses
- Low stock
- Upcoming follow-ups

### Salesperson

- My leads
- Today's follow-ups
- Conversions
- Pending follow-ups

### Accountant

- Today's collection
- Pending dues
- Expenses
- Invoices

### HR user

- Employees
- Attendance
- Leaves
- Payroll

Dashboard widgets enabled services and user permissions ke basis par dynamically generate honge.

## 15. Key Module Experiences

### 15.1 People

Primary capabilities:

- Search and filters
- Person type, status, branch and tags
- Import / export
- Shared person profile
- Payments, attendance, documents and activity tabs
- Person ko additional role/context assign karna

### 15.2 CRM

- Table and Kanban views
- Configurable pipeline stages
- Lead assignment
- Follow-ups
- Expected value
- Conversion to person/customer/member
- Activity timeline

### 15.3 Finance

- Collections
- Pending payments
- Invoices
- Expenses
- Refunds
- Payment methods
- Complete transaction audit trail

### 15.4 HR & Payroll

- Employees
- Departments
- Attendance
- Leave
- Payroll generation
- Deductions
- Salary slips

### 15.5 Inventory

- Products and SKUs
- Current stock
- Low-stock status
- Out-of-stock status
- Stock value
- Stock movement history

## 16. Quick Actions

Major screens par contextual primary action hoga, jaise `+ Add Person` ya `+ Record Payment`.

Global `+ Create` action:

```text
Create
├── Person
├── Lead
├── Payment
├── Invoice
├── Employee
├── Product
└── Expense
```

Sirf enabled services aur allowed permissions ke actions show honge.

## 17. Notifications

Notification categories:

- Overdue payment
- Follow-up due
- Payment received
- Low stock
- Leave request
- Invitation status
- Service or subscription update

Notifications actionable aur role-aware honi chahiye.

## 18. Billing Strategy

Possible service pricing model:

```text
CRM        ₹999
People     ₹799
Finance    ₹999
HR         ₹1,499
Inventory  ₹899
```

Later service addition ke liye billing options:

### Initial recommendation

Service next billing cycle se activate karna operationally simplest rahega.

### Future option

Immediate activation with prorated charge:

```text
Remaining billing days × proportional service price
```

Activation screen par price, effective date aur next renewal amount clearly show hona chahiye.

## 19. Super Admin Platform

Super Admin UI organisation workspace se completely separate hoga.

Technical deployment decision:

```text
apps/web      Client and organisation workspace frontend
apps/admin    CRMKaro Super Admin frontend
apps/api      Shared modular backend/API
apps/worker   Shared background-job worker
```

The client workspace and Super Admin will be separate frontend applications with separate login surfaces, route boundaries and deployments. For the MVP they will use the same shared modular backend and PostgreSQL database. Super Admin APIs will remain isolated behind dedicated modules, permissions, mandatory MFA and audit logging.

Primary capabilities:

- Organisations
- Plans
- Services and features
- Subscriptions
- Usage limits
- Users
- Billing
- Support
- System health
- Audit and system logs

Example organisation overview:

```text
ABC Academy
Plan: Custom
Users: 15 / 20

CRM        Active
People     Active
Finance    Active
HR         Disabled
Inventory  Disabled
```

## 20. Security and Audit Requirements

### 20.1 Encryption decision

Pure end-to-end encryption will **not** be used across CRMKaro. It would prevent or significantly complicate server-side search, reports, dashboards, notifications, automations, integrations, support and account recovery.

CRMKaro will instead use a practical layered model:

- HTTPS/TLS for all data in transit
- Encryption at rest for databases, uploaded files and backups
- Application-level encryption for especially sensitive fields
- Managed KMS or equivalent key vault for encryption keys
- Passwords stored using secure one-way hashing such as Argon2id
- Encryption keys kept separate from encrypted business data

The application may decrypt authorised operational data when required, but direct database access or a database backup alone should not expose protected plaintext.

### 20.2 Tenant isolation

- Every organisation-owned record will carry an `organisation_id`.
- All application queries will be automatically scoped to the active organisation.
- Database Row-Level Security should provide a second isolation layer where supported.
- Automated tests must verify that one organisation cannot access another organisation's records.
- Record ownership must be checked even when a valid record ID is supplied directly.

### 20.3 Request authorisation

Every protected backend request must verify:

1. User authentication
2. Organisation membership
3. Active service and feature entitlement
4. Role and action-level permission
5. Record ownership by the active organisation

Frontend menu visibility is not a security boundary. Authorisation must always be enforced by the backend and, where appropriate, the database.

### 20.4 Identity and access

- Role-based access control with fine-grained permissions
- Deny-by-default and least-privilege access
- MFA for privileged Admin accounts
- Mandatory MFA for CRMKaro Super Admins
- Secure, short-lived sessions and session revocation
- Login and OTP rate limiting
- Separate permissions for sensitive operations such as export, refund, payroll and role management
- No permanent developer access to production systems
- Temporary privileged access must be approved and logged

### 20.5 Audit and monitoring

Audit logs must cover:

- Login attempts and session changes
- User invitations, removal and permission changes
- Service activation and deactivation
- Data imports and exports
- Financial transactions and refunds
- Payroll actions
- Sensitive record access
- Super Admin operations

Audit logs must not contain passwords, OTPs, secret keys or unnecessary sensitive values. Security monitoring should alert on suspicious logins, repeated access failures, bulk exports and unusual privileged activity.

### 20.6 Application and file security

- Parameterised database queries
- Protection against SQL injection, XSS and CSRF
- Server-side input validation
- API rate limiting and brute-force protection
- Secure headers and Content Security Policy
- File type, MIME and size validation
- Malware scanning for uploaded files
- Signed, short-expiry file download URLs
- CSV formula-injection protection
- Secrets must never be committed to source control
- Automated dependency, code and secret scanning

### 20.7 Backups and recovery

- Automated encrypted backups
- Point-in-time recovery where supported
- Backup access restricted and audited
- Backups stored separately from primary production data
- Regular restore tests
- Defined retention, recovery point and recovery time policies
- Documented security incident response and credential/key rotation process

### 20.8 Privacy

- Collect only data required for the product's stated purpose.
- Apply retention and deletion policies by data category.
- Provide controlled data export, correction and deletion workflows.
- Do not expose sensitive values in URLs, application logs or analytics.
- Review Indian DPDP obligations and other applicable requirements before production launch.

## 21. Decisions Already Locked

- Product will be a modular Business Operating System, not a single-purpose CRM.
- Organisations can add more services later.
- Activated services control both navigation and backend API access.
- Services contain features and can support future granular plans.
- People will be a shared entity across modules.
- Disabled services retain their data.
- Onboarding will collect only minimum required configuration.
- Dashboards will be role-aware and service-aware.
- Super Admin and organisation workspace will be separate products/surfaces.
- Configuration and entitlements will drive behaviour; industry conditions will not be scattered through code.
- Pure end-to-end encryption will not be used across the CRM because it conflicts with core operational features.
- CRMKaro will use TLS, encryption at rest, application-level sensitive-field encryption and managed key storage.
- Tenant isolation will be enforced at application and database levels, not only through the UI.
- Privileged Admin access will use MFA; Super Admin MFA will be mandatory.
- Sensitive operations and privileged access will be recorded in protected audit logs.
- The first product phase must include Leads, Payments, Salary/Payroll and Inventory.
- Client workspace and CRMKaro Super Admin will use separate frontend applications.
- The MVP will use one shared modular backend/API and database, with isolated Super Admin modules and permissions.
- The approved technology stack is a TypeScript monorepo using Next.js client/admin frontends, a NestJS modular backend, PostgreSQL, Prisma, Redis/BullMQ, S3-compatible object storage and Docker.
- Detailed database schema, API design and UI/UX decisions may be selected according to maintainability, usability, security and MVP scope without requiring separate product decisions for every implementation detail.
- The primary visual direction will use trustworthy blue, restrained teal success accents and neutral slate surfaces; destructive and warning colours will be reserved for semantic states.

## 22. Confirmed First-Phase Scope

The first usable release will validate CRMKaro as a multi-service business platform rather than only a CRM. The detailed scope below is now the working MVP boundary.

### 22.1 MVP outcome

An organisation must be able to:

1. Create and configure its workspace.
2. Invite a small team with controlled access.
3. Capture leads and convert them into customers.
4. Create invoices, record payments and track dues and expenses.
5. Maintain employee salary details and run a basic monthly payroll.
6. Track products and stock movements.
7. View role-aware operational summaries and audit important actions.

### 22.2 Platform foundation

- Google login and email OTP authentication
- Create one primary organisation during onboarding
- Organisation profile: name, type, industry, contact details, timezone and currency
- Initial service selection with all confirmed MVP services available
- Organisation-scoped workspace and strict tenant isolation
- Invite, resend invitation, deactivate and reactivate team members
- Fixed roles: Owner, Admin, Sales, Accountant, HR and Staff
- Service entitlements and backend permission enforcement
- Role-aware dashboard and navigation
- Global activity feed
- In-app notifications; email is limited to OTP and invitations
- Organisation settings, invoice/receipt prefixes and payment methods
- Audit logs and complete security foundation
- Responsive web application; no native mobile app in MVP
- Single active branch/location in MVP, with the data model kept multi-branch-ready
- A user may belong to multiple organisations; each session has one explicit active organisation

### 22.3 People

- One shared person record with contextual types: Customer, Student, Member and Employee
- A person may have more than one type without creating duplicates
- Fields: name, primary phone, alternate phone, email, address, status, tags and notes
- List, search, filters, sorting and pagination
- Person profile with overview, finance history and activity timeline
- Create, edit and archive; hard deletion is restricted
- Duplicate warning using normalised phone and email
- CSV import with column mapping, validation preview and error report
- CSV export controlled by a separate permission
- Links between person, lead, invoice, payment and employee profile
- Attachments and advanced custom fields are deferred

### 22.4 Leads / CRM

- Create a lead manually or through CSV import
- Fields: name, phone, email, source, expected value, stage, owner, next follow-up, tags and notes
- Default stages: New, Contacted, Interested, Follow-up, Converted and Lost
- Admin can rename, reorder, add and deactivate pipeline stages
- Table and Kanban views
- Assign and reassign leads to team members
- Add notes and maintain an activity timeline
- Schedule, complete, reschedule and mark follow-ups overdue
- Filters by stage, owner, source, follow-up date and tags
- Convert a lead into a shared person/customer without duplicating identity data
- Require a reason when a lead is marked Lost
- Dashboard metrics: new leads, stage totals, due follow-ups and conversions
- Basic source and salesperson performance reports
- No workflow builder, lead scoring, web forms or external marketing integrations in MVP

### 22.5 Payments / Basic Finance

- Create draft invoices with customer, dates, line items, quantity, rate, discount and optional tax
- Configurable invoice and receipt numbering prefixes
- Invoice states: Draft, Issued, Partially Paid, Paid, Overdue, Cancelled
- Record full or partial payments against an invoice or directly against a person
- Payment methods: Cash, UPI, Bank Transfer, Card and Other
- Generate printable/downloadable invoice and payment receipt PDFs
- Maintain customer ledger and outstanding balance
- Record basic expenses with category, date, amount, payment method, payee and notes
- Payment correction through reversal/adjustment; posted financial records are not silently overwritten
- Basic refund entry linked to the original payment
- Reports: daily/monthly collection, pending dues, invoices, payments and expenses
- Finance actions recorded in an immutable audit trail
- Single organisation currency in MVP
- Optional basic tax percentage and tax identifier fields; complete GST filing/compliance is deferred
- No bank reconciliation, double-entry accounting, credit notes, vendor bills or multi-currency in MVP

### 22.6 Salary / Basic Payroll

- Employee profile linked to a shared person record
- Fields: employee code, department, designation, joining date, employment status and payout details
- Monthly salary structure with base salary plus reusable earning and deduction components
- Generate a payroll run for a selected month
- Payroll states: Draft, Approved, Processing, Paid and Cancelled
- Per-employee manual adjustments before approval
- Lock approved payroll values to preserve history
- Mark salary paid with date, method and reference
- Generate printable/downloadable salary slips
- Payroll summary: gross, deductions, net payable, paid and pending
- Access restricted to Owner, authorised Admin and HR roles
- Salary and payroll actions recorded in an audit trail
- Attendance and leave do not automatically calculate salary in MVP
- No automatic TDS, PF, ESI, professional tax, statutory filing or bank payout integration in MVP

### 22.7 Inventory

- Product fields: name, SKU, category, unit, selling price, cost price, opening stock and low-stock threshold
- Unique SKU within an organisation
- Product list, search, filters and status
- Stock-in, stock-out and manual adjustment entries
- Every stock movement stores quantity, reason, date, user and reference
- Current stock is derived from controlled stock movements
- Prevent accidental negative stock by default; authorised override requires a reason
- Low-stock and out-of-stock indicators and notifications
- Product-wise stock movement history
- Basic inventory value using the current stored cost price
- CSV product import with validation and error report
- Reports: current stock, low stock and movement history
- Single stock location in MVP
- Suppliers, purchase orders, sales orders, multiple warehouses, barcode scanning, batches, serial numbers and expiry tracking are deferred

### 22.8 Dashboards and notifications

Owner/Admin dashboard:

- Lead pipeline and conversions
- Today's and overdue follow-ups
- Collections and pending dues
- Payroll status and pending salary
- Stock value and low-stock count
- Recent organisation activity

Sales dashboard:

- My leads, follow-ups and conversions

Accountant dashboard:

- Collections, dues, invoices, expenses and recorded salary payments

HR dashboard:

- Active employees and current payroll status

Notifications included in MVP:

- Follow-up due or overdue
- Invoice/payment due
- Payment recorded
- Payroll awaiting approval or salary pending
- Low stock
- Team invitation and account status

SMS, WhatsApp, push notifications and user-configurable automation rules are deferred.

### 22.9 MVP role boundaries

- **Owner:** Full organisation access, billing/services, roles and sensitive settings
- **Admin:** Broad operational access, excluding ownership transfer and platform billing unless granted
- **Sales:** Assigned leads, follow-ups and permitted People data
- **Accountant:** Invoices, payments, expenses and finance reports
- **HR:** Employee profiles, salary structures, payroll and salary slips
- **Staff:** Limited People and operational access configured through the fixed Staff permission set

Custom roles and a visual permission builder are deferred, but permissions will remain granular internally so they can be added later.

### 22.10 Minimum Super Admin

- View and search organisations
- View enabled services, plan/status and user counts
- Activate, suspend and reactivate an organisation
- Enable or disable services with an audit reason
- View platform users and organisation memberships
- View security and service audit events
- Basic plan and usage-limit configuration
- No ability to silently impersonate a customer user
- Any exceptional support access must be explicit, time-bound and audited

### 22.11 Explicitly deferred from MVP

- Attendance and leave management
- Statutory payroll and automated tax compliance
- Complete GST filing/accounting
- Double-entry bookkeeping and bank reconciliation
- Suppliers and purchase orders
- Multiple branches and warehouses in the UI
- Barcode, batch, serial-number and expiry workflows
- Custom fields, custom roles and workflow builder
- WhatsApp, SMS and third-party business integrations
- AI features
- Customer portal and native mobile apps
- Multi-currency and multilingual interface
- Advanced subscription automation and prorated billing
- Advanced analytics and dashboard builder

### 22.12 MVP acceptance boundary

The MVP is considered functionally complete when a test organisation can complete this connected scenario without manual database intervention:

```text
Create organisation and invite team
→ Capture and assign a lead
→ Schedule a follow-up
→ Convert the lead into a customer
→ Create an invoice
→ Record a partial and final payment
→ Add an employee and salary structure
→ Generate, approve and mark monthly payroll paid
→ Add a product and record stock-in/stock-out
→ Observe correct role dashboards, notifications and audit events
```

### First-phase module package

```text
Core Platform
+ People
+ Leads / CRM
+ Payments / Basic Finance
+ Salary / Basic Payroll
+ Inventory
+ Security and Audit Foundation
```

## 23. Open Decisions

These items need to be finalized before or during detailed product design:

- Plan structure and pricing
- Trial policy
- Immediate versus next-cycle service activation
- Data retention after subscription cancellation
- Final CSV import size and record limits
- Long-term GST, statutory payroll and accounting roadmap
- Required third-party integrations

## 24. Recommended Next Steps

The database model, API conventions, permission matrix, UI design system and deployment architecture are recorded in `TECHNICAL_DESIGN.md`.

1. Convert the confirmed MVP into a detailed PRD with user stories and acceptance criteria.
2. Create low-fidelity wireframes for onboarding and core module flows.
3. Scaffold the approved monorepo and local infrastructure.
4. Build authentication, organisation context and tenancy foundation.
5. Implement service entitlements before individual business modules.
6. Build the shared People module.
7. Implement CRM, Finance, Payroll and Inventory incrementally.
8. Verify the connected MVP acceptance scenario with audit and cross-tenant security tests.

---

This document captures the product and architecture planning completed so far. It should be updated whenever a major product, UX, billing or technical decision is finalized.
