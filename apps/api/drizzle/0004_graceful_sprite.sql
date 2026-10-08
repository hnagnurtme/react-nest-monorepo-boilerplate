-- The key on `user_roles` was `(user_id, role_id)`, from when an account had
-- exactly one tenant. With several, the same role in two tenants is the normal
-- case — TENANT_ADMIN of one tenant and of another — and that key refused it
-- with a unique violation the moment an invitation was accepted.
--
-- Two partial unique indexes rather than a three-column primary key: a primary
-- key cannot cover `tenant_id`, which is null for a platform-scope assignment.
ALTER TABLE "user_roles" DROP CONSTRAINT "pk_user_roles";--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_roles_tenant" ON "user_roles" USING btree ("user_id","role_id","tenant_id") WHERE tenant_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_roles_platform" ON "user_roles" USING btree ("user_id","role_id") WHERE tenant_id IS NULL;