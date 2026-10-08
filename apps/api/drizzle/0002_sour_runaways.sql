CREATE TABLE "user_tenants" (
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_user_tenants" PRIMARY KEY("user_id","tenant_id")
);
--> statement-breakpoint
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_tenants_tenant_id" ON "user_tenants" USING btree ("tenant_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Multi-tenant membership (hand-written, rule 03-database-drizzle.md F1).
--
-- An account may now belong to several tenants. `user_tenants` is the authority
-- for membership; a request still acts inside exactly one tenant, chosen by the
-- caller and validated by JwtAuthGuard, so `app.tenant_id` stays a single uuid
-- and every other policy is unchanged.
-- ---------------------------------------------------------------------------

-- Existing accounts keep acting where they already were.
INSERT INTO "user_tenants" ("user_id", "tenant_id")
SELECT "id", "tenant_id" FROM "users" WHERE "tenant_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

ALTER TABLE "user_tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_tenants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_tenants_access_policy" ON "user_tenants"
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

-- Visibility of a user now follows membership, not the home tenant: a tenant
-- admin must see an account that joined their tenant while living elsewhere.
--
-- WITH CHECK keeps the home-tenant branch as well, because on INSERT the
-- membership row does not exist yet (it is written next, in the same
-- transaction). `users.tenant_id` cannot be repointed from tenant mode — the
-- trigger below refuses that — so the branch only admits the creating tenant.
DROP POLICY "users_access_policy" ON "users";--> statement-breakpoint
CREATE POLICY "users_access_policy" ON "users"
  FOR ALL
  TO boilerplate_app
  USING (
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND EXISTS (
        SELECT 1 FROM "user_tenants" ut
        WHERE ut."user_id" = "users"."id"
          AND ut."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND (
        "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        OR EXISTS (
          SELECT 1 FROM "user_tenants" ut
          WHERE ut."user_id" = "users"."id"
            AND ut."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        )
      )
    )
  );--> statement-breakpoint

-- The home tenant must be a tenant the account actually belongs to, so the
-- column and the membership table cannot drift.
--
-- Two triggers, because the two paths need different timing. On INSERT the
-- membership row is written after the user inside the same transaction, so the
-- check has to be deferred to commit. On UPDATE nothing is pending, so it is
-- immediate — and an immediate check is also what makes the rule observable to
-- a caller that rolls back.
CREATE FUNCTION "check_user_home_tenant"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."tenant_id" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM "user_tenants" ut
       WHERE ut."user_id" = NEW."id" AND ut."tenant_id" = NEW."tenant_id"
     ) THEN
    RAISE EXCEPTION 'home tenant is not a tenant of this account' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "trg_users_check_home_tenant"
  AFTER INSERT ON "users"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "check_user_home_tenant"();--> statement-breakpoint

-- Only 'admin' mode may move an account's home tenant. Otherwise a tenant admin
-- could point an account at another tenant, or clear it and strip the account of
-- its tenant altogether. The membership check runs here as well: in 'tenant'
-- mode the function sees only the active tenant's rows, so the only home tenant
-- it can approve is the one the request already acts in.
CREATE FUNCTION "guard_user_home_tenant_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id" THEN
    IF current_setting('app.access_mode', true) <> 'admin' THEN
      RAISE EXCEPTION 'home tenant can only be changed in admin mode' USING ERRCODE = '42501';
    END IF;
    IF NEW."tenant_id" IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM "user_tenants" ut
         WHERE ut."user_id" = NEW."id" AND ut."tenant_id" = NEW."tenant_id"
       ) THEN
      RAISE EXCEPTION 'home tenant is not a tenant of this account' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "trg_users_guard_home_tenant_change"
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION "guard_user_home_tenant_change"();--> statement-breakpoint

-- `user_roles.tenant_id` is no longer stamped from the user: with several
-- tenants per account the caller must say which membership the role belongs to,
-- and the assignment is only valid inside a tenant the account is a member of.
CREATE OR REPLACE FUNCTION "check_user_role_assignment"() RETURNS trigger LANGUAGE plpgsql AS $$
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

  IF role_scope = 'platform' THEN
    IF user_tenant IS NOT NULL THEN
      RAISE EXCEPTION 'platform roles can only be assigned to platform users' USING ERRCODE = '23514';
    END IF;
    IF NEW.tenant_id IS NOT NULL THEN
      RAISE EXCEPTION 'a platform role assignment carries no tenant' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'a tenant role assignment needs a tenant' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_tenants ut
    WHERE ut.user_id = NEW.user_id AND ut.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'the account does not belong to that tenant' USING ERRCODE = '23514';
  END IF;
  IF role_tenant IS NOT NULL AND role_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'role belongs to another tenant' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;
