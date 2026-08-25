-- Authentication sessions, OTP challenges and Google OAuth account linking.

CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "active_organisation_id" UUID,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(6),
  "ip_address" INET,
  "user_agent" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_otp_challenges" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumed_at" TIMESTAMPTZ(6),
  "request_ip" INET,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_accounts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "provider" VARCHAR(40) NOT NULL,
  "provider_account_id" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_states" (
  "id" UUID NOT NULL,
  "state_hash" CHAR(64) NOT NULL,
  "redirect_uri" VARCHAR(500) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at");
CREATE INDEX "auth_sessions_active_organisation_id_idx" ON "auth_sessions"("active_organisation_id");
CREATE INDEX "email_otp_challenges_email_created_at_idx" ON "email_otp_challenges"("email", "created_at" DESC);
CREATE INDEX "email_otp_challenges_expires_at_idx" ON "email_otp_challenges"("expires_at");
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");
CREATE UNIQUE INDEX "oauth_accounts_user_id_provider_key" ON "oauth_accounts"("user_id", "provider");
CREATE UNIQUE INDEX "oauth_states_state_hash_key" ON "oauth_states"("state_hash");
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states"("expires_at");

ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_active_organisation_id_fkey" FOREIGN KEY ("active_organisation_id") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "oauth_accounts"
  ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A signed-in user may discover only their own memberships before selecting an active organisation.
CREATE POLICY "membership_self_discovery" ON "organisation_memberships"
  FOR SELECT
  USING (
    "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
