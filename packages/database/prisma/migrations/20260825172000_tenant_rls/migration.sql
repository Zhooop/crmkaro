-- Tenant isolation is enforced in addition to application-level repository scoping.
-- The runtime database role must not be a superuser, table owner or BYPASSRLS role.

ALTER TABLE "organisations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organisations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "organisation_isolation" ON "organisations"
  USING (
    "id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    "id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );

ALTER TABLE "organisation_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organisation_memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "membership_isolation" ON "organisation_memberships"
  USING (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "system_roles_are_readable" ON "roles"
  FOR SELECT
  USING ("organisation_id" IS NULL);
CREATE POLICY "organisation_role_isolation" ON "roles"
  USING (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "system_role_permissions_are_readable" ON "role_permissions"
  FOR SELECT
  USING ("organisation_id" IS NULL);
CREATE POLICY "organisation_role_permission_isolation" ON "role_permissions"
  USING (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );

ALTER TABLE "organisation_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organisation_services" FORCE ROW LEVEL SECURITY;
CREATE POLICY "organisation_service_isolation" ON "organisation_services"
  USING (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_isolation" ON "audit_logs"
  USING (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );

ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "outbox_event_isolation" ON "outbox_events"
  USING (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );

