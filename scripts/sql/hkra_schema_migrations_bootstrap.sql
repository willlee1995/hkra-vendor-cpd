-- Applied once by run-migrations scripts before applying repo migrations.
CREATE TABLE IF NOT EXISTS public.hkra_schema_migrations (
  version text PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
