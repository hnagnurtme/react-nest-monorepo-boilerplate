-- `uq_users_email` reserved an address for good: a delete is soft, so the row
-- stays, every lookup skips it, and re-creating that account failed with a bare
-- unique violation nobody could clear. Unique among live rows only.
ALTER TABLE "users" DROP CONSTRAINT "uq_users_email";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email_active" ON "users" USING btree ("email") WHERE deleted_at IS NULL;