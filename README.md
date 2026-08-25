# CRMKaro

CRMKaro is a modular business operating system for organisations that need CRM, people, finance, payroll and inventory workflows in one secure workspace.

## Applications

- `apps/web` — organisation workspace
- `apps/admin` — CRMKaro Super Admin
- `apps/api` — shared modular NestJS API
- `apps/worker` — background jobs

## Documentation

- [Product plan](./PROJECT_PLAN.md)
- [Technical design](./TECHNICAL_DESIGN.md)
- [Phase 1 roadmap](./PHASE1_ROADMAP.md)

## Local development

Requirements:

- Node.js 24+
- pnpm 11+
- PostgreSQL
- Redis

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The local infrastructure and database schema will be added in Phase 1.2.

