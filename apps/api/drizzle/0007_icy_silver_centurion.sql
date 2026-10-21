CREATE TABLE "administrative_units" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"level" text NOT NULL,
	"parent_code" text,
	CONSTRAINT "ck_administrative_units_level" CHECK ("administrative_units"."level" IN ('PROVINCE', 'WARD')),
	CONSTRAINT "ck_administrative_units_parent" CHECK (("administrative_units"."level" = 'PROVINCE') = ("administrative_units"."parent_code" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "tenant_details" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"logo_object_key" text,
	"address_line" text,
	"ward_code" text,
	"province_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tenant_details_ward_pair" CHECK (("tenant_details"."ward_code" IS NULL) = ("tenant_details"."province_code" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "tenant_details" ADD CONSTRAINT "tenant_details_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_details" ADD CONSTRAINT "tenant_details_ward_code_administrative_units_code_fk" FOREIGN KEY ("ward_code") REFERENCES "public"."administrative_units"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_details" ADD CONSTRAINT "tenant_details_province_code_administrative_units_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."administrative_units"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_administrative_units_parent" ON "administrative_units" USING btree ("parent_code");--> statement-breakpoint
CREATE INDEX "ix_administrative_units_level" ON "administrative_units" USING btree ("level");--> statement-breakpoint
CREATE INDEX "ix_tenant_details_province" ON "tenant_details" USING btree ("province_code");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hand-written below the generated DDL (rule 03-database-drizzle F1).
--
-- The ward -> province self reference. Drizzle does not emit a self FK, so it
-- is written here. RESTRICT: a province row is only ever removed by a re-sync
-- after a new merger, and that must fail loudly while wards still point at it.
ALTER TABLE "administrative_units"
  ADD CONSTRAINT "fk_administrative_units_parent"
  FOREIGN KEY ("parent_code") REFERENCES "administrative_units" ("code")
  ON DELETE RESTRICT;--> statement-breakpoint

-- ENABLE *and* FORCE: without FORCE the role that owns the tables (the
-- migration role) bypasses its own policies. Exactly one policy, because two
-- PERMISSIVE policies are OR-ed together (ADR-0003).
--
-- A platform-wide catalog, like `permissions`: every mode reads it — the tenant
-- form needs it before any tenant is chosen — and only `admin` mode writes, so
-- the migration job fills it and no tenant can edit it.
ALTER TABLE "administrative_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "administrative_units" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "administrative_units_access_policy" ON "administrative_units"
  FOR ALL
  TO boilerplate_app
  USING (true)
  WITH CHECK (current_setting('app.access_mode', true) = 'admin');--> statement-breakpoint

-- Tenant-scoped, so the same policy every tenant-owned table carries.
ALTER TABLE "tenant_details" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_details" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_details_access_policy" ON "tenant_details"
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
  );
