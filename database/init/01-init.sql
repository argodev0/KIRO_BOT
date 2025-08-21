-- Initial database setup for AI Crypto Trading Bot
-- This script runs when the PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create database if it doesn't exist (handled by Docker environment)
-- The database 'trading_bot' is created automatically by the POSTGRES_DB environment variable

-- Set timezone
SET timezone = 'UTC';

-- Create indexes for better performance (these will be created by Prisma migrations)
-- But we can add some initial setup here if needed

-- Log the initialization
DO $$
BEGIN
    RAISE NOTICE 'AI Crypto Trading Bot database initialized successfully';
END $$;