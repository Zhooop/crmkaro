# CRMKaro Operations Runbook

## Environments

- Production and staging use separate databases, credentials, OAuth clients and email providers.
- The API connects through the restricted application role; migrations use the owner role.
- Secrets live in the hosting provider's secret manager and never in Git or application logs.
- TLS is mandatory at the load balancer, database and backup-storage boundaries.

## Deployment

1. Confirm CI passes lint, typecheck, unit tests and production builds.
2. Take an on-demand encrypted database snapshot.
3. Apply Prisma migrations with `DIRECT_DATABASE_URL` using `pnpm db:deploy`.
4. Deploy API and worker, then client and admin applications.
5. Verify `/api/v1/health`, authentication, tenant switching and the connected MVP smoke test.
6. Monitor error rate, latency and failed jobs for at least 30 minutes.

Rollback application containers to the previous immutable release. Database migrations are forward-only; prepare a corrective migration instead of editing an applied migration.

## Backup and restore

- Run an encrypted daily full PostgreSQL backup with 35-day retention and weekly off-site copies.
- Restrict backup access to the operations role and record every restore/download event.
- Test restoration monthly in an isolated account with no outbound email or integrations.

Example backup command (credentials supplied securely by the environment):

```bash
pg_dump --format=custom --no-owner --file=crmkaro.dump "$DIRECT_DATABASE_URL"
```

Restore verification:

```bash
createdb crmkaro_restore_test
pg_restore --exit-on-error --no-owner --dbname=crmkaro_restore_test crmkaro.dump
```

After restore, run migration status, row counts, tenant-isolation tests and a representative invoice/payroll workflow. Delete the isolated restore database after verification.

## Incident response

1. Classify severity and preserve logs/audit evidence.
2. Revoke affected sessions or credentials; rotate secrets when exposure is suspected.
3. Isolate the affected tenant/service without accessing unrelated tenant data.
4. Restore service, validate integrity and document the timeline.
5. Notify affected customers and authorities when contractual or legal rules require it.

Never paste production records, access tokens, OTPs or database dumps into support tickets or chat tools.
