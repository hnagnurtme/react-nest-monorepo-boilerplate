-- Database roles. Idempotent: this runs before every migration, on a fresh
-- local container and on the throwaway Postgres service CI spins up.
--
-- Three roles, because "the app can create tables" and "the app can read every
-- tenant's data" are the same mistake wearing different hats:
--   boilerplate_owner    — DDL. drizzle-kit and migrate.ts only.
--   boilerplate_app      — DML, NOBYPASSRLS. What the running API connects as.
--   boilerplate_readonly — SELECT. Reporting and replicas.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'boilerplate_owner') THEN
    CREATE ROLE boilerplate_owner LOGIN PASSWORD 'owner' NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'boilerplate_app') THEN
    CREATE ROLE boilerplate_app LOGIN PASSWORD 'app' NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'boilerplate_readonly') THEN
    CREATE ROLE boilerplate_readonly LOGIN PASSWORD 'readonly' NOBYPASSRLS;
  END IF;
END
$$;

-- The connection running this is privileged (the `postgres` superuser locally
-- and in CI). It needs membership in boilerplate_owner so migrate.ts can
-- `SET ROLE boilerplate_owner` and have the migration's tables owned by it.
-- Guarded: on managed Postgres (Neon, PG16+) re-running a GRANT that already
-- exists fails with "permission denied to grant role", which broke every
-- migration run after the first.
DO $$
BEGIN
  IF NOT pg_has_role(current_user, 'boilerplate_owner', 'MEMBER') THEN
    GRANT boilerplate_owner TO CURRENT_USER;
  END IF;
END
$$;

ALTER SCHEMA public OWNER TO boilerplate_owner;

-- drizzle keeps its migration journal in its own schema, so the owner role
-- needs CREATE on the database itself, not just on `public`.
DO $$
BEGIN
  EXECUTE format('GRANT CREATE, CONNECT ON DATABASE %I TO boilerplate_owner', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO boilerplate_app, boilerplate_readonly', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO boilerplate_app, boilerplate_readonly;

-- Applies to tables that already exist...
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO boilerplate_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO boilerplate_readonly;

-- ...and, separately, to tables a future migration creates. This must be in
-- place BEFORE the tables exist; forgetting it is why a new table works in dev
-- (where someone re-ran the grant by hand) and 403s in production.
ALTER DEFAULT PRIVILEGES FOR ROLE boilerplate_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO boilerplate_app;
ALTER DEFAULT PRIVILEGES FOR ROLE boilerplate_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO boilerplate_readonly;
