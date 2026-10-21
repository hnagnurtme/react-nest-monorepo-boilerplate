-- Trigram indexes for the `?search=` filter on users: `ILIKE '%term%'` has a
-- leading wildcard, which no b-tree can serve. `pg_trgm` is created by
-- migrate.ts as superuser, before it drops to the owner role.
CREATE INDEX "idx_users_full_name_trgm" ON "users" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_users_email_trgm" ON "users" USING gin ("email" gin_trgm_ops);