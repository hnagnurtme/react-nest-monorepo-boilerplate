CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"subject" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"scope_preset" text DEFAULT 'own_tenant' NOT NULL,
	CONSTRAINT "pk_role_permissions" PRIMARY KEY("role_id","permission_id"),
	CONSTRAINT "ck_role_permissions_preset" CHECK ("role_permissions"."scope_preset" IN ('any', 'own_tenant', 'own_record'))
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"scope" text DEFAULT 'tenant' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ck_roles_scope" CHECK ("roles"."scope" IN ('platform', 'tenant')),
	CONSTRAINT "ck_roles_system_tenant" CHECK (("roles"."is_system") = ("roles"."tenant_id" IS NULL)),
	CONSTRAINT "ck_roles_platform_system" CHECK ("roles"."scope" = 'tenant' OR "roles"."is_system")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"tenant_id" uuid,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_user_roles" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "ck_users_role";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "ck_users_tenant_role";--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_permissions_action_subject" ON "permissions" USING btree ("action","subject");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_permission_id" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_roles_tenant_key" ON "roles" USING btree ("tenant_id","key") WHERE tenant_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_roles_system_key" ON "roles" USING btree ("key") WHERE tenant_id IS NULL;--> statement-breakpoint
CREATE INDEX "idx_roles_tenant_id" ON "roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_role_id" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_tenant_id" ON "user_roles" USING btree ("tenant_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Data migration: system roles + backfill of user_roles from users.role.
--
-- The owner role is subject to FORCE ROW LEVEL SECURITY and no policy names it,
-- so it would read zero rows from "users". RLS is lifted on that one table for
-- the duration of the backfill and restored right after. The permission grants
-- of the system roles are filled in by migrate.ts (it syncs PERMISSION_CATALOG
-- and SYSTEM_ROLES from @repo/shared-types), not duplicated here.
--> statement-breakpoint
INSERT INTO "roles" ("id", "tenant_id", "key", "name", "scope", "is_system") VALUES
  ('00000000-0000-4000-8000-000000000001', NULL, 'PLATFORM_ADMIN', 'Platform administrator', 'platform', true),
  ('00000000-0000-4000-8000-000000000002', NULL, 'TENANT_ADMIN', 'Tenant administrator', 'tenant', true),
  ('00000000-0000-4000-8000-000000000003', NULL, 'TENANT_MEMBER', 'Tenant member', 'tenant', true)
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "users" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "user_roles" ("user_id", "role_id", "tenant_id")
SELECT u."id", r."id", u."tenant_id"
FROM "users" u
JOIN "roles" r ON r."is_system" AND r."key" = u."role"
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Row Level Security for the permission tables. Exactly ONE policy per table,
-- ENABLE + FORCE (see the policies for tenants/users above).
--
-- permissions : the catalog is readable by everyone, writable only in 'admin'
--               mode (the migration job).
-- roles       : a tenant sees the shared tenant-scope system roles (tenant_id NULL;
--               platform-scope roles stay hidden) and its own, but can only write rows of its own tenant. The WITH CHECK
--               below blocks changing a system row; the trigger blocks deleting
--               one, which a single policy cannot tell apart from a read.
-- role_permissions / user_roles: follow their role / tenant.
--> statement-breakpoint
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "permissions_access_policy" ON "permissions"
  FOR ALL
  TO boilerplate_app
  USING (true)
  WITH CHECK (current_setting('app.access_mode', true) = 'admin');--> statement-breakpoint

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "roles_access_policy" ON "roles"
  FOR ALL
  TO boilerplate_app
  USING (
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND (
        ("tenant_id" IS NULL AND "scope" = 'tenant')
        OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );--> statement-breakpoint

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "role_permissions_access_policy" ON "role_permissions"
  FOR ALL
  TO boilerplate_app
  USING (
    current_setting('app.access_mode', true) = 'admin'
    OR EXISTS (SELECT 1 FROM "roles" r WHERE r."id" = "role_id")
  )
  WITH CHECK (
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND EXISTS (
        SELECT 1 FROM "roles" r
        WHERE r."id" = "role_id"
          AND r."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
    )
  );--> statement-breakpoint

ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_roles_access_policy" ON "user_roles"
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

-- ---------------------------------------------------------------------------
-- Integrity triggers (invoker rights, so they see only what the caller may).
--
-- 1. System roles and their grants change only when the migration job sets
--    app.system_roles_write = 'on'. Not even an 'admin'-mode API call can.
-- 2. user_roles.tenant_id always equals the user's tenant, and a role can only
--    be assigned when its scope fits the user: platform roles to tenant-less
--    users, tenant roles to users with a tenant, and a custom role only inside
--    its own tenant.
--> statement-breakpoint
CREATE FUNCTION "guard_system_roles"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_role_id uuid;
  target_is_system boolean;
BEGIN
  IF TG_TABLE_NAME = 'roles' THEN
    target_is_system := COALESCE(OLD.is_system, false);
  ELSE
    target_role_id := COALESCE(OLD.role_id, NEW.role_id);
    SELECT r.is_system INTO target_is_system FROM roles r WHERE r.id = target_role_id;
  END IF;

  IF COALESCE(target_is_system, false)
     AND COALESCE(current_setting('app.system_roles_write', true), '') <> 'on' THEN
    RAISE EXCEPTION 'system roles are immutable' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END
$$;--> statement-breakpoint
CREATE TRIGGER "trg_roles_guard_system"
  BEFORE UPDATE OR DELETE ON "roles"
  FOR EACH ROW EXECUTE FUNCTION "guard_system_roles"();--> statement-breakpoint
CREATE TRIGGER "trg_role_permissions_guard_system"
  BEFORE INSERT OR UPDATE OR DELETE ON "role_permissions"
  FOR EACH ROW EXECUTE FUNCTION "guard_system_roles"();--> statement-breakpoint

CREATE FUNCTION "check_user_role_assignment"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  user_tenant uuid;
  user_found boolean;
  role_tenant uuid;
  role_scope text;
  role_found boolean;
BEGIN
  SELECT u.tenant_id, true INTO user_tenant, user_found FROM users u WHERE u.id = NEW.user_id;
  SELECT r.tenant_id, r.scope, true INTO role_tenant, role_scope, role_found
    FROM roles r WHERE r.id = NEW.role_id AND r.deleted_at IS NULL;

  IF NOT COALESCE(user_found, false) OR NOT COALESCE(role_found, false) THEN
    RAISE EXCEPTION 'user or role not visible' USING ERRCODE = '42501';
  END IF;
  IF role_scope = 'platform' AND user_tenant IS NOT NULL THEN
    RAISE EXCEPTION 'platform roles can only be assigned to platform users' USING ERRCODE = '23514';
  END IF;
  IF role_scope = 'tenant' AND user_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant roles need a user that belongs to a tenant' USING ERRCODE = '23514';
  END IF;
  IF role_tenant IS NOT NULL AND role_tenant IS DISTINCT FROM user_tenant THEN
    RAISE EXCEPTION 'role belongs to another tenant' USING ERRCODE = '23514';
  END IF;

  NEW.tenant_id := user_tenant;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "trg_user_roles_check"
  BEFORE INSERT OR UPDATE ON "user_roles"
  FOR EACH ROW EXECUTE FUNCTION "check_user_role_assignment"();
