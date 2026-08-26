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
- [Operations runbook](./docs/OPERATIONS_RUNBOOK.md)
- [Release checklist](./docs/PHASE1_RELEASE_CHECKLIST.md)

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

Start PostgreSQL and Redis with `docker compose -f infrastructure/compose.yaml up -d`, then apply migrations with `pnpm db:deploy` and seed local service/permission data with `pnpm db:seed`.
