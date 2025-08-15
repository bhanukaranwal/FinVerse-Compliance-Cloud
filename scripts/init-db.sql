-- Create database if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'finverse_db') THEN
        CREATE DATABASE finverse_db;
    END IF;
END $$;

-- Connect to the database
\c finverse_db;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS compliance;

-- Set timezone
SET timezone = 'UTC';

-- Create custom types
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN', 'TRADER', 'ACCOUNTANT', 'AUDITOR', 'VIEWER');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade_side') THEN
        CREATE TYPE trade_side AS ENUM ('buy', 'sell');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
        CREATE TYPE document_type AS ENUM ('PDF', 'IMAGE', 'EXCEL', 'CSV', 'TEXT', 'OTHER');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_priority') THEN
        CREATE TYPE notification_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
    END IF;
END $$;

-- Create audit function
CREATE OR REPLACE FUNCTION audit.create_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit.audit_log (
        table_name,
        operation,
        old_values,
        new_values,
        user_id,
        timestamp
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        current_setting('app.current_user_id', true),
        NOW()
    );
    
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit.audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit.audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit.audit_log(user_id);

-- Create function to generate short IDs
CREATE OR REPLACE FUNCTION generate_short_id(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT USAGE ON SCHEMA audit TO PUBLIC;
GRANT SELECT ON audit.audit_log TO PUBLIC;
GRANT USAGE ON SCHEMA analytics TO PUBLIC;
GRANT USAGE ON SCHEMA compliance TO PUBLIC;

-- Create performance monitoring views
CREATE OR REPLACE VIEW analytics.performance_summary AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public';

-- Create system health monitoring
CREATE OR REPLACE VIEW analytics.system_health AS
SELECT 
    'database_size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value,
    NOW() as timestamp
UNION ALL
SELECT 
    'active_connections' as metric,
    count(*)::text as value,
    NOW() as timestamp
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT 
    'total_tables' as metric,
    count(*)::text as value,
    NOW() as timestamp
FROM information_schema.tables
WHERE table_schema = 'public';

-- Insert initial configuration data
INSERT INTO public.configurations (key, value, description) VALUES 
    ('app.version', '2.1.0', 'Application version'),
    ('db.initialized_at', NOW()::text, 'Database initialization timestamp'),
    ('features.ai_enabled', 'true', 'AI features enabled'),
    ('features.voice_assistant', 'true', 'Voice assistant enabled'),
    ('features.social_trading', 'true', 'Social trading enabled'),
    ('compliance.auto_check', 'true', 'Automatic compliance checking'),
    ('tax.auto_calculate', 'true', 'Automatic tax calculation')
ON CONFLICT (key) DO NOTHING;

-- Log initialization
INSERT INTO audit.audit_log (table_name, operation, new_values, user_id, timestamp)
VALUES ('system', 'INITIALIZE', '{"version": "2.1.0", "status": "initialized"}', NULL, NOW());