# CRMKaro — Local-to-Live Deployment Workflow

> Last verified: 28 August 2026  
> Production VPS: Hostinger `72.61.169.18`  
> Server checkout: `/root/apps/crmkaro`  
> GitHub repository: `Zhooop/crmkaro`

This document records how CRMKaro code currently moves from the development Mac to GitHub and then to the live Hostinger VPS. It intentionally contains no passwords, private keys, API keys or production environment values.

## Deployment flow

```text
Local Mac workspace
        │
        │ test → commit → push with personal GitHub SSH identity
        ▼
GitHub: Zhooop/crmkaro (main)
        │
        │ HTTPS git pull from the public repository
        ▼
Hostinger VPS: /root/apps/crmkaro
        │
        │ install → migrate when required → build → restart
        ▼
PM2 processes
        │
        ▼
Nginx + HTTPS domains
```

## 1. How the Mac accesses GitHub

The local repository uses this remote:

```text
git@github.com-personal:Zhooop/crmkaro.git
```

`github.com-personal` is an SSH host alias configured on the Mac. It selects the personal GitHub SSH key instead of another GitHub account configured on the same computer.

The personal identity can be loaded into the macOS keychain with:

```bash
ssh-add --apple-use-keychain /Users/pushpaindunath/.ssh/id_ed25519_personal
```

Authentication can be checked without changing anything:

```bash
ssh -T github.com-personal
```

Expected account: `PushpainduNath`.

The SSH private key and its passphrase must remain on the Mac and must never be committed, copied to the project, written into this document or shared in chat.

## 2. Local development and verification

Repository location on the Mac:

```text
/Volumes/Pushpaindu/Freelancing/crmkaro
```

Before committing a change:

```bash
cd /Volumes/Pushpaindu/Freelancing/crmkaro
git status --short
pnpm typecheck
pnpm build
```

Run narrower relevant tests as they are added. For a database change, review the generated migration before deployment and test it locally first.

Do not commit `.env`, credentials, database dumps, build output or personal SSH keys.

## 3. Commit and push from the Mac

Review the exact changes:

```bash
git diff --check
git diff
git status --short
```

Stage only intended files, then commit and push:

```bash
git add <intended-files>
git commit -m "type: short description"
git push origin main
```

Confirm that local `HEAD` and the tracked GitHub branch match:

```bash
git rev-parse HEAD
git rev-parse '@{u}'
```

Deployment must not begin if tests fail, unrelated changes are included, or the intended commit is not present on GitHub.

## 4. How the VPS is accessed

The current administrative connection is SSH:

```bash
ssh root@72.61.169.18
```

The Codex environment currently uses non-interactive SSH access already authorised on the server. The VPS authentication secret is not stored in Git or this guide.

Long-term hardening recommendation: use a named non-root deployment user with an SSH key, disable password-based root login, and grant only the required deployment/service permissions.

## 5. Pull the approved code on the VPS

The VPS checkout pulls the public GitHub repository over HTTPS:

```text
https://github.com/Zhooop/crmkaro.git
```

On the server:

```bash
cd /root/apps/crmkaro
git status --short
git fetch origin main
git pull --ff-only origin main
git rev-parse HEAD
```

`--ff-only` prevents the VPS from creating an accidental merge commit. The server currently contains an untracked production-only `ecosystem.config.cjs`; preserve it during pulls and do not overwrite it casually.

The commit SHA returned by the VPS should match the locally pushed/GitHub SHA.

## 6. Install dependencies

The server currently uses Node.js `24.12.0` through NVM and pnpm `11.19.0`:

```bash
source /root/.nvm/nvm.sh
nvm use 24.12.0
cd /root/apps/crmkaro
pnpm install --frozen-lockfile
```

Dependency installation is required when `package.json`, any workspace package manifest or `pnpm-lock.yaml` changes. Running it consistently is safer than trying to guess whether a transitive dependency changed.

## 7. Apply database migrations when required

Production configuration is stored in `/root/apps/crmkaro/.env` and is not tracked by Git.

If the release contains a new reviewed Prisma migration:

```bash
cd /root/apps/crmkaro
set -a
source .env
set +a
pnpm db:deploy
```

Do not run development migration commands or reset/seed production data during a normal deployment. Before a risky schema change, create and verify a recoverable database backup. Prisma production migrations are forward-only; fix a failed deployed migration with a corrective migration.

## 8. Build the applications

The public API URL must be available while building the Next.js applications because public environment values are embedded at build time. The production `.env` should already provide the approved values.

```bash
cd /root/apps/crmkaro
set -a
source .env
set +a
pnpm build
```

A failed build means the deployment stops; do not restart live processes with incomplete output.

## 9. Restart the CRMKaro processes

Current PM2 process mapping:

| Process | Internal port | Public route | Current state |
| --- | ---: | --- | --- |
| `crmkaro-web-3200` | 3200 | `https://crmkaro.com` | Running |
| `crmkaro-admin-3201` | 3201 | `https://admin.crmkaro.com` | Running |
| `crmkaro-api-4200` | 4200 | `https://api.crmkaro.com` | Running |
| `crmkaro-worker` | — | No public route | Stopped placeholder |

Load Node/PM2, then restart only CRMKaro services:

```bash
source /root/.nvm/nvm.sh
nvm use 24.12.0
cd /root/apps/crmkaro
pm2 restart crmkaro-api-4200 crmkaro-web-3200 crmkaro-admin-3201
pm2 save
pm2 status
```

Do not restart unrelated applications hosted on the same VPS. Do not start `crmkaro-worker` until its production job-processing implementation and configuration are ready.

If PM2 configuration itself changes, review `ecosystem.config.cjs` carefully and use the explicitly named CRMKaro entries rather than deleting/recreating the entire PM2 process list.

## 10. Nginx routing

Nginx configuration is enabled at:

```text
/etc/nginx/sites-enabled/crmkaro
```

Current routing:

- `crmkaro.com` and `www.crmkaro.com` → `127.0.0.1:3200`
- `admin.crmkaro.com` → `127.0.0.1:3201`
- `api.crmkaro.com` → `127.0.0.1:4200`

Normal code deployments do not require an Nginx reload. When routing or TLS configuration changes:

```bash
nginx -t
systemctl reload nginx
```

Never reload Nginx if `nginx -t` fails.

## 11. Post-deployment verification

Check services and recent logs on the VPS:

```bash
source /root/.nvm/nvm.sh
nvm use 24.12.0
pm2 status
pm2 logs crmkaro-api-4200 --lines 100 --nostream
pm2 logs crmkaro-web-3200 --lines 100 --nostream
pm2 logs crmkaro-admin-3201 --lines 100 --nostream
```

Check public endpoints:

```bash
curl -fsS https://api.crmkaro.com/api/v1/health
curl -I https://crmkaro.com/login
curl -I https://admin.crmkaro.com
```

Then manually verify the changed workflow in a browser. For authentication changes, test OTP delivery, login, session persistence and logout. For tenant data, verify the correct organisation and at least one denied-permission case.

## 12. Confirm all three Git locations are synchronised

Local Mac:

```bash
cd /Volumes/Pushpaindu/Freelancing/crmkaro
git rev-parse HEAD
git status --short
```

GitHub tracking reference:

```bash
git fetch origin main
git rev-parse origin/main
```

VPS:

```bash
ssh root@72.61.169.18 'cd /root/apps/crmkaro && git rev-parse HEAD && git status --short'
```

The three commit SHAs should match. A clean code checkout is preferred; the known VPS exception is the untracked production-only `ecosystem.config.cjs`.

## 13. Rollback approach

If the new release breaks production:

1. Preserve logs and identify the last known-good commit SHA.
2. Prefer a new corrective commit on `main`, then follow the same deployment workflow.
3. For an urgent application-only rollback, deploy the last known-good commit deliberately without deleting user data or resetting the repository.
4. Restart only CRMKaro services and repeat all health checks.
5. Do not reverse an applied production database migration with destructive Git or database commands; create a reviewed corrective migration.

## Per-change deployment checklist

- [ ] Intended code is complete and reviewed locally.
- [ ] Typecheck, build and relevant tests pass.
- [ ] No secret or unrelated file is staged.
- [ ] Commit is pushed to GitHub `main`.
- [ ] Database backup is available when the migration risk requires it.
- [ ] VPS uses `git pull --ff-only` and reaches the intended commit SHA.
- [ ] Dependencies are installed and migrations are applied when required.
- [ ] Production build completes successfully.
- [ ] Only CRMKaro PM2 processes are restarted.
- [ ] API, Web and Admin health checks pass.
- [ ] Changed user workflow is manually verified live.
- [ ] Local, GitHub and VPS commit SHAs match.
- [ ] `CURRENT_STATUS.md` is updated when feature status changes.

