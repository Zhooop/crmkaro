-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('OPEN', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "people" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "person_activities" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tags" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "pipelines" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,
    "colour" VARCHAR(7) NOT NULL DEFAULT '#64748B',
    "is_converted" BOOLEAN NOT NULL DEFAULT false,
    "is_lost" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "person_id" UUID,
    "pipeline_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "owner_membership_id" UUID,
    "name" VARCHAR(180) NOT NULL,
    "phone" VARCHAR(32),
    "phone_normalised" VARCHAR(24),
    "email" VARCHAR(320),
    "email_normalised" VARCHAR(320),
    "source" VARCHAR(80),
    "expected_value_minor" INTEGER,
    "status" "LeadStatus" NOT NULL DEFAULT 'OPEN',
    "lost_reason" VARCHAR(500),
    "converted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "assigned_to_membership_id" UUID,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'SCHEDULED',
    "outcome" VARCHAR(1000),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "body" VARCHAR(5000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "summary" VARCHAR(240) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipelines_organisation_id_is_active_idx" ON "pipelines"("organisation_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_organisation_id_name_key" ON "pipelines"("organisation_id", "name");

-- CreateIndex
CREATE INDEX "pipeline_stages_organisation_id_is_active_idx" ON "pipeline_stages"("organisation_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_pipeline_id_name_key" ON "pipeline_stages"("pipeline_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_pipeline_id_position_key" ON "pipeline_stages"("pipeline_id", "position");

-- CreateIndex
CREATE INDEX "leads_organisation_id_status_stage_id_idx" ON "leads"("organisation_id", "status", "stage_id");

-- CreateIndex
CREATE INDEX "leads_organisation_id_owner_membership_id_idx" ON "leads"("organisation_id", "owner_membership_id");

-- CreateIndex
CREATE INDEX "leads_organisation_id_phone_normalised_idx" ON "leads"("organisation_id", "phone_normalised");

-- CreateIndex
CREATE INDEX "leads_organisation_id_email_normalised_idx" ON "leads"("organisation_id", "email_normalised");

-- CreateIndex
CREATE INDEX "follow_ups_organisation_id_status_due_at_idx" ON "follow_ups"("organisation_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "follow_ups_organisation_id_assigned_to_membership_id_due_at_idx" ON "follow_ups"("organisation_id", "assigned_to_membership_id", "due_at");

-- CreateIndex
CREATE INDEX "lead_notes_organisation_id_lead_id_created_at_idx" ON "lead_notes"("organisation_id", "lead_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "lead_activities_organisation_id_lead_id_created_at_idx" ON "lead_activities"("organisation_id", "lead_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "organisation_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assigned_to_membership_id_fkey" FOREIGN KEY ("assigned_to_membership_id") REFERENCES "organisation_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce tenant isolation independently of application filters.
ALTER TABLE "pipelines" ENABLE ROW LEVEL SECURITY; ALTER TABLE "pipelines" FORCE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY; ALTER TABLE "pipeline_stages" FORCE ROW LEVEL SECURITY;
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY; ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;
ALTER TABLE "follow_ups" ENABLE ROW LEVEL SECURITY; ALTER TABLE "follow_ups" FORCE ROW LEVEL SECURITY;
ALTER TABLE "lead_notes" ENABLE ROW LEVEL SECURITY; ALTER TABLE "lead_notes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "lead_activities" ENABLE ROW LEVEL SECURITY; ALTER TABLE "lead_activities" FORCE ROW LEVEL SECURITY;

CREATE POLICY "pipelines_isolation" ON "pipelines" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "pipeline_stages_isolation" ON "pipeline_stages" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "leads_isolation" ON "leads" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "follow_ups_isolation" ON "follow_ups" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "lead_notes_isolation" ON "lead_notes" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "lead_activities_isolation" ON "lead_activities" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
