-- Initialize the knowledge_base database
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions that might be useful
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- Create a read-only user for reporting (optional)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'readonly') THEN
        CREATE ROLE readonly;
    END IF;
END
$$;

-- Grant connect privilege
GRANT CONNECT ON DATABASE knowledge_base TO readonly;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO readonly;

-- Grant select on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;

-- Grant select on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;
