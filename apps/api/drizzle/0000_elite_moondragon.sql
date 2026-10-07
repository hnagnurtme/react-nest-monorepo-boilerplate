CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"tenant_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"ip_address" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"parent_id" uuid,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_sessions_token_hash" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_tenants_slug" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"phone_number" text,
	"role" text DEFAULT 'TENANT_MEMBER' NOT NULL,
	"tenant_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_users_email" UNIQUE("email"),
	CONSTRAINT "ck_users_role" CHECK ("users"."role" IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'TENANT_MEMBER')),
	CONSTRAINT "ck_users_tenant_role" CHECK (("users"."role" IN ('TENANT_ADMIN', 'TENANT_MEMBER')) = ("users"."tenant_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_parent_id_sessions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_tenant_id" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor_id" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_family_id" ON "sessions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tenants_deleted_at" ON "tenants" USING btree ("deleted_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_users_tenant_id" ON "users" USING btree ("tenant_id");
-- Row Level Security. Hand-written below the generated DDL, which
-- drizzle-kit cannot express (docs/rules/03-database-drizzle.md F1).
--
-- Exactly ONE policy per table. Two PERMISSIVE policies are OR'd together by
-- Postgres, so a second policy widens access instead of narrowing it (ADR-0003).
--
-- ENABLE alone is not enough: the migration role owns every table, and an owner
-- bypasses its own policies unless the table is also FORCEd.
--
-- Session variables (set per transaction by TransactionManager):
--   app.access_mode  'admin' | 'tenant'   (unset => every branch is false => zero rows)
--   app.tenant_id    uuid of the caller's tenant, '' otherwise
--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenants_access_policy" ON "tenants"
  FOR ALL
  TO boilerplate_app
  USING (
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND "id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  )
  WITH CHECK (
    -- A tenant may edit its own row but never create another one: the check
    -- is on the NEW row, so inserting a different id fails.
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND "id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );--> statement-breakpoint

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_access_policy" ON "users"
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

-- sessions has no tenant_id: it is reachable only from the auth flow, which
-- runs in 'admin' mode with an explicit reason. Any other caller sees an empty
-- table, which is the intent.
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sessions_access_policy" ON "sessions"
  FOR ALL
  TO boilerplate_app
  USING (current_setting('app.access_mode', true) = 'admin')
  WITH CHECK (current_setting('app.access_mode', true) = 'admin');--> statement-breakpoint

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "audit_logs_access_policy" ON "audit_logs"
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
    -- An audit entry is written by the actor's own context, and a tenant may
    -- never write a row attributed to a different tenant.
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );
