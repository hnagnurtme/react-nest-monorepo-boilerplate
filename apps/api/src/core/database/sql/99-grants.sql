-- Re-grants after migrations, as a belt to the ALTER DEFAULT PRIVILEGES braces
-- in 00-roles.sql. Cheap, idempotent, and it covers the case where a table was
-- created by a different role than the default privileges were declared for.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO boilerplate_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO boilerplate_readonly;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO boilerplate_app;
