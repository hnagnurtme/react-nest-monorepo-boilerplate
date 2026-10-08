CREATE TABLE "tenant_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_ids" uuid[] NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tenant_invitations_tenant_id" ON "tenant_invitations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_invitations_token_hash" ON "tenant_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_invitations_pending" ON "tenant_invitations" USING btree ("tenant_id","user_id") WHERE accepted_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- RLS for the invitations (hand-written, rule 03-database-drizzle.md F1).
--
-- A tenant sees and withdraws its own invitations. Accepting one runs in
-- 'admin' mode on purpose: the invitee has no session in that tenant yet — the
-- membership is what accepting creates — so the token is the only credential
-- the request can carry, and it is checked in the service.
-- ---------------------------------------------------------------------------
ALTER TABLE "tenant_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_invitations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_invitations_access_policy" ON "tenant_invitations"
  FOR ALL
  TO boilerplate_app
  USING (
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );--> statement-breakpoint

-- An invitation is only valid for a tenant the account does not already belong
-- to, and only for an account that can belong to a tenant at all. Checked here
-- as well as in the service, because a row that violates it would mint a link
-- that fails at the last step, long after the admin was told it was sent.
CREATE FUNCTION "check_tenant_invitation"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  home_tenant uuid;
  user_found boolean;
BEGIN
  SELECT u.tenant_id, true INTO home_tenant, user_found FROM users u WHERE u.id = NEW.user_id;
  IF NOT COALESCE(user_found, false) THEN
    RAISE EXCEPTION 'user not visible' USING ERRCODE = '42501';
  END IF;
  IF home_tenant IS NULL THEN
    RAISE EXCEPTION 'a platform account cannot join a tenant' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM user_tenants ut
    WHERE ut.user_id = NEW.user_id AND ut.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'the account already belongs to that tenant' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "trg_tenant_invitations_check"
  BEFORE INSERT ON "tenant_invitations"
  FOR EACH ROW EXECUTE FUNCTION "check_tenant_invitation"();
