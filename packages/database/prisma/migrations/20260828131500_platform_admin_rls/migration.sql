-- Allow Table Owners and Platform Admins to perform cross-tenant operations and telemetry.
-- Standard application tenant sessions (crmkaro_app without app.is_platform_admin) remain strictly isolated.

ALTER TABLE "organisations" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "organisation_memberships" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "organisation_services" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "people" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "person_types" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tags" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "person_tags" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "person_activities" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "pipelines" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_stages" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "leads" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "follow_ups" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "lead_notes" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "lead_activities" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "organisation_sequences" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoices" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "payment_refunds" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "expenses" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "employees" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "salary_structures" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "payroll_runs" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "payroll_items" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "product_categories" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "products" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" NO FORCE ROW LEVEL SECURITY;

-- Update organisation isolation policy to allow platform admin operations
DROP POLICY IF EXISTS "organisation_isolation" ON "organisations";
CREATE POLICY "organisation_isolation" ON "organisations"
  USING (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    OR "id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    OR "id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );

DROP POLICY IF EXISTS "membership_isolation" ON "organisation_memberships";
CREATE POLICY "membership_isolation" ON "organisation_memberships"
  USING (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    OR "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    OR "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );

DROP POLICY IF EXISTS "organisation_service_isolation" ON "organisation_services";
CREATE POLICY "organisation_service_isolation" ON "organisation_services"
  USING (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    OR "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    OR "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );

DROP POLICY IF EXISTS "audit_log_isolation" ON "audit_logs";
CREATE POLICY "audit_log_isolation" ON "audit_logs"
  USING (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    OR "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    OR "organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid
  );
