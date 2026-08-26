CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "PersonTypeCode" AS ENUM ('CUSTOMER', 'STUDENT', 'MEMBER', 'EMPLOYEE');

CREATE TABLE "people" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organisation_id" UUID NOT NULL,
  "display_name" VARCHAR(180) NOT NULL, "primary_phone" VARCHAR(32), "primary_phone_normalised" VARCHAR(24),
  "alternate_phone" VARCHAR(32), "email" VARCHAR(320), "email_normalised" VARCHAR(320),
  "address_json" JSONB, "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE', "notes" TEXT,
  "archived_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "person_types" (
  "organisation_id" UUID NOT NULL, "person_id" UUID NOT NULL, "type" "PersonTypeCode" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "person_types_pkey" PRIMARY KEY ("person_id", "type")
);
CREATE TABLE "tags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organisation_id" UUID NOT NULL, "name" VARCHAR(80) NOT NULL,
  "colour" VARCHAR(7) NOT NULL DEFAULT '#64748B', "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "tags_pkey" PRIMARY KEY ("id"), CONSTRAINT "tags_organisation_id_name_key" UNIQUE ("organisation_id", "name")
);
CREATE TABLE "person_tags" (
  "organisation_id" UUID NOT NULL, "person_id" UUID NOT NULL, "tag_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "person_tags_pkey" PRIMARY KEY ("person_id", "tag_id")
);
CREATE TABLE "person_activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organisation_id" UUID NOT NULL, "person_id" UUID NOT NULL,
  "actor_user_id" UUID, "action" VARCHAR(100) NOT NULL, "summary" VARCHAR(240) NOT NULL, "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "person_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "people_organisation_id_status_display_name_idx" ON "people"("organisation_id", "status", "display_name");
CREATE INDEX "people_organisation_id_primary_phone_normalised_idx" ON "people"("organisation_id", "primary_phone_normalised");
CREATE INDEX "people_organisation_id_email_normalised_idx" ON "people"("organisation_id", "email_normalised");
CREATE INDEX "person_types_organisation_id_type_idx" ON "person_types"("organisation_id", "type");
CREATE INDEX "tags_organisation_id_idx" ON "tags"("organisation_id");
CREATE INDEX "person_tags_organisation_id_tag_id_idx" ON "person_tags"("organisation_id", "tag_id");
CREATE INDEX "person_activities_organisation_id_person_id_created_at_idx" ON "person_activities"("organisation_id", "person_id", "created_at" DESC);

ALTER TABLE "people" ADD CONSTRAINT "people_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_types" ADD CONSTRAINT "person_types_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_types" ADD CONSTRAINT "person_types_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_tags" ADD CONSTRAINT "person_tags_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_tags" ADD CONSTRAINT "person_tags_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_tags" ADD CONSTRAINT "person_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_activities" ADD CONSTRAINT "person_activities_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_activities" ADD CONSTRAINT "person_activities_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_activities" ADD CONSTRAINT "person_activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "people" ENABLE ROW LEVEL SECURITY; ALTER TABLE "people" FORCE ROW LEVEL SECURITY;
ALTER TABLE "person_types" ENABLE ROW LEVEL SECURITY; ALTER TABLE "person_types" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY; ALTER TABLE "tags" FORCE ROW LEVEL SECURITY;
ALTER TABLE "person_tags" ENABLE ROW LEVEL SECURITY; ALTER TABLE "person_tags" FORCE ROW LEVEL SECURITY;
ALTER TABLE "person_activities" ENABLE ROW LEVEL SECURITY; ALTER TABLE "person_activities" FORCE ROW LEVEL SECURITY;

CREATE POLICY "people_isolation" ON "people" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "person_types_isolation" ON "person_types" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "tags_isolation" ON "tags" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "person_tags_isolation" ON "person_tags" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "person_activities_isolation" ON "person_activities" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
