# Phase 1 Release Checklist

## Product acceptance

- [ ] New owner can authenticate and create an organisation.
- [ ] Enabled services and navigation match organisation entitlements.
- [ ] People, leads, finance, payroll and inventory happy paths pass in staging.
- [ ] Role presets cannot access unauthorised salary, finance or override actions.
- [ ] Dashboard cards, notifications and activities reflect current data.

## Security and reliability

- [ ] Production secrets and OAuth callback URLs are configured outside Git.
- [ ] TLS, secure cookies, CORS and security headers are verified.
- [ ] Tenant-isolation and append-only audit tests pass against the release schema.
- [ ] Rate limits, input limits and permission-denied responses are tested.
- [ ] Encrypted backup succeeds and an isolated restore test passes.
- [ ] Database alerts, API error monitoring and uptime checks are enabled.

## Experience and operations

- [ ] Keyboard navigation, focus states, contrast and mobile layouts are checked.
- [ ] Empty, loading, error and unauthenticated states are verified.
- [ ] Invoice and salary-slip PDFs render correctly.
- [ ] Staging smoke test and production rollback rehearsal are complete.
- [ ] Release owner records approval, timestamp and commit SHA below.

Release owner: _Pending_  
Approved commit: _Pending_  
Release timestamp: _Pending_
