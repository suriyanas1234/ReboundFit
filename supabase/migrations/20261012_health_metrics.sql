-- ============================================================================
-- Migration: 20261012_health_metrics.sql
-- Apple Health / HealthKit Integration Table and User Sync Tokens
-- ============================================================================

-- 1. Add Apple Health Sync Token column to user profiles if not present
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS apple_health_sync_token TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_apple_health_sync_token 
ON public.profiles(apple_health_sync_token) 
WHERE apple_health_sync_token IS NOT NULL;

-- 2. Create health_metrics table
CREATE TABLE IF NOT EXISTS public.health_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Weight / Body Mass
    weight_lbs NUMERIC(5, 2),
    weight_kg NUMERIC(5, 2),
    
    -- Energy Expenditure (Calories)
    active_energy_burned_kcal NUMERIC(6, 1), -- HKQuantityTypeIdentifierActiveEnergyBurned
    basal_energy_burned_kcal NUMERIC(6, 1),  -- HKQuantityTypeIdentifierBasalEnergyBurned
    total_energy_burned_kcal NUMERIC(6, 1),  -- Active + Basal expenditure
    
    -- Daily Activity & Movement
    step_count INT,                          -- HKQuantityTypeIdentifierStepCount
    distance_km NUMERIC(5, 2),               -- HKQuantityTypeIdentifierDistanceWalkingRunning
    
    -- Sleep & Recovery
    sleep_hours NUMERIC(4, 2),               -- HKCategoryTypeIdentifierSleepAnalysis (total hours asleep)
    deep_sleep_hours NUMERIC(4, 2),          -- Deep sleep breakdown in hours
    
    -- Cardiovascular Vitals
    resting_heart_rate_bpm INT,              -- HKQuantityTypeIdentifierRestingHeartRate
    
    -- Ingestion metadata
    source TEXT NOT NULL DEFAULT 'apple_health', -- 'apple_health_shortcuts', 'health_auto_export', etc.
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Enforce single row per user per calendar day
    CONSTRAINT uq_user_health_metrics_date UNIQUE (user_id, date)
);

-- Index for speedy date-range querying on the Summary feed
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_date 
ON public.health_metrics(user_id, date DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own metrics
CREATE POLICY "Users can manage own health metrics"
    ON public.health_metrics FOR ALL
    USING (auth.uid() = user_id);

-- Trigger for auto-updating updated_at timestamp
DROP TRIGGER IF EXISTS trg_health_metrics_updated_at ON public.health_metrics;
CREATE TRIGGER trg_health_metrics_updated_at
    BEFORE UPDATE ON public.health_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
