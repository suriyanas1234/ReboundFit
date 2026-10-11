-- ============================================================================
-- ReboundFit Supabase Database Schema
-- Lean Bulk & Body Recomposition Optimized Personal Fitness Tracking
-- ============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
CREATE TYPE activity_level_enum AS ENUM ('sedentary', 'light', 'moderate', 'very_active', 'extra_active');
CREATE TYPE unit_preference_enum AS ENUM ('imperial', 'metric'); -- imperial: lbs/in, metric: kg/cm
CREATE TYPE gain_rate_goal_enum AS ENUM ('lean_bulk_slow', 'lean_bulk_standard', 'recomp_maintenance', 'aggressive_bulk');
CREATE TYPE meal_type_enum AS ENUM ('breakfast', 'lunch', 'dinner', 'post_workout', 'snack');
CREATE TYPE muscle_group_enum AS ENUM ('chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'calves', 'abs', 'full_body');
CREATE TYPE exercise_category_enum AS ENUM ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'weighted_bodyweight');
CREATE TYPE pr_type_enum AS ENUM ('weight', 'reps', 'estimated_1rm', 'volume');
CREATE TYPE photo_pose_enum AS ENUM ('front_relaxed', 'front_flexed', 'side_left', 'side_right', 'back_lat_spread', 'back_relaxed');

-- ============================================================================
-- 2. USERS & PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    gender gender_enum NOT NULL DEFAULT 'male',
    birth_date DATE NOT NULL,
    height_cm NUMERIC(5, 2) NOT NULL, -- Stored natively in cm
    activity_level activity_level_enum NOT NULL DEFAULT 'moderate',
    unit_preference unit_preference_enum NOT NULL DEFAULT 'imperial',
    
    -- Goal & Target Settings
    gain_rate_goal gain_rate_goal_enum NOT NULL DEFAULT 'lean_bulk_standard',
    target_gain_lbs_per_week NUMERIC(4, 2) NOT NULL DEFAULT 0.35, -- Sweet spot: 0.25 - 0.50 lbs/wk
    protein_ratio_per_lb NUMERIC(3, 2) NOT NULL DEFAULT 0.90, -- 0.8 - 1.0g per lb of bodyweight
    fat_calorie_percentage NUMERIC(3, 2) NOT NULL DEFAULT 0.25, -- 25% of calories from healthy fats
    
    -- Dynamic Engine Calculated Values
    base_tdee INT NOT NULL DEFAULT 2400,
    smoothed_tdee INT NOT NULL DEFAULT 2400,
    target_calories INT NOT NULL DEFAULT 2675, -- TDEE + surplus
    target_protein_g INT NOT NULL DEFAULT 170,
    target_carb_g INT NOT NULL DEFAULT 315,
    target_fat_g INT NOT NULL DEFAULT 74,
    
    -- State metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. WEIGH-INS TABLE (Smart Scale Logger & Trendline)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.weigh_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
    raw_weight_lbs NUMERIC(5, 2) NOT NULL,
    raw_weight_kg NUMERIC(5, 2) NOT NULL,
    trend_weight_lbs NUMERIC(5, 2), -- 7-day smoothed EMA calculated via engine
    trend_weight_kg NUMERIC(5, 2),
    rate_of_gain_lbs_per_week NUMERIC(4, 2), -- Derived 7-day rate of gain
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One weigh-in per day per user enforced
    CONSTRAINT uq_user_weigh_in_date UNIQUE (user_id, logged_at)
);

CREATE INDEX IF NOT EXISTS idx_weigh_ins_user_date ON public.weigh_ins(user_id, logged_at DESC);

-- ============================================================================
-- 4. ADAPTIVE TDEE CHECK-INS / WEEKLY RECALIBRATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tdee_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    avg_intake_calories INT NOT NULL,
    trend_weight_start_lbs NUMERIC(5, 2) NOT NULL,
    trend_weight_end_lbs NUMERIC(5, 2) NOT NULL,
    weight_delta_lbs NUMERIC(4, 2) NOT NULL,
    estimated_energy_delta_kcal INT NOT NULL,
    calculated_tdee INT NOT NULL,
    previous_smoothed_tdee INT NOT NULL,
    new_smoothed_tdee INT NOT NULL,
    adjustment_applied_kcal INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdee_audit_user ON public.tdee_audit_logs(user_id, period_end_date DESC);

-- ============================================================================
-- 5. FOOD ITEMS & NUTRITION DATABASE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.foods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL indicates global verified whole food
    name TEXT NOT NULL,
    brand TEXT,
    barcode TEXT,
    serving_size NUMERIC(6, 2) NOT NULL DEFAULT 100,
    serving_unit TEXT NOT NULL DEFAULT 'g', -- 'g', 'ml', 'scoop', 'slice', 'oz'
    calories INT NOT NULL,
    protein_g NUMERIC(5, 1) NOT NULL DEFAULT 0,
    carb_g NUMERIC(5, 1) NOT NULL DEFAULT 0,
    fat_g NUMERIC(5, 1) NOT NULL DEFAULT 0,
    fiber_g NUMERIC(5, 1) DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foods_name ON public.foods(name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_foods_barcode ON public.foods(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_foods_user ON public.foods(user_id);

-- Daily Food Log Entries (Supports both Itemized and Frictionless Quick-Log)
CREATE TABLE IF NOT EXISTS public.meal_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    food_id UUID REFERENCES public.foods(id) ON DELETE SET NULL,
    logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type meal_type_enum NOT NULL DEFAULT 'lunch',
    custom_name TEXT NOT NULL DEFAULT 'Quick Log Entry',
    servings NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    
    -- Actual recorded macros (Quick Log populates these directly)
    calories INT NOT NULL,
    protein_g NUMERIC(5, 1) NOT NULL DEFAULT 0,
    carb_g NUMERIC(5, 1) NOT NULL DEFAULT 0,
    fat_g NUMERIC(5, 1) NOT NULL DEFAULT 0,
    is_quick_dial BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date ON public.meal_logs(user_id, logged_date DESC);

-- Meal Templates (Saved Favorites for repetitive bulking meals)
CREATE TABLE IF NOT EXISTS public.meal_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Morning Mass Shake (1,000 kcal)"
    meal_type meal_type_enum NOT NULL DEFAULT 'breakfast',
    total_calories INT NOT NULL,
    total_protein_g NUMERIC(5, 1) NOT NULL,
    total_carb_g NUMERIC(5, 1) NOT NULL,
    total_fat_g NUMERIC(5, 1) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meal_template_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES public.meal_templates(id) ON DELETE CASCADE,
    food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
    servings NUMERIC(4, 2) NOT NULL DEFAULT 1.0
);

-- ============================================================================
-- 6. WORKOUTS, EXERCISES & PROGRESSIVE OVERLOAD LOGGER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL = System defaults
    name TEXT NOT NULL,
    muscle_group muscle_group_enum NOT NULL,
    category exercise_category_enum NOT NULL DEFAULT 'barbell',
    is_compound BOOLEAN NOT NULL DEFAULT TRUE,
    default_rest_seconds INT NOT NULL DEFAULT 120, -- 2 min default for compound, 90s for isolation
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_muscle ON public.exercises(muscle_group);

-- Routine Templates (Push / Pull / Legs, Upper / Lower, Full Body)
CREATE TABLE IF NOT EXISTS public.routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL = curated templates
    name TEXT NOT NULL, -- e.g., "Push A (Chest & Triceps Hypertrophy)"
    description TEXT,
    is_system_template BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.routine_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    order_index INT NOT NULL DEFAULT 0,
    target_sets INT NOT NULL DEFAULT 3,
    target_reps_min INT NOT NULL DEFAULT 6,
    target_reps_max INT NOT NULL DEFAULT 10,
    target_rpe NUMERIC(3, 1) DEFAULT 8.5
);

-- Logged Workout Sessions
CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL,
    name TEXT NOT NULL, -- e.g. "Push Day Hypertrophy"
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    notes TEXT,
    total_volume_lbs NUMERIC(8, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_started ON public.workouts(user_id, started_at DESC);

-- Workout Sets with Inline Previous Benchmark & PR detection
CREATE TABLE IF NOT EXISTS public.workout_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    set_number INT NOT NULL,
    weight_lbs NUMERIC(6, 2) NOT NULL,
    weight_kg NUMERIC(6, 2) NOT NULL,
    reps INT NOT NULL,
    rpe NUMERIC(3, 1), -- Rate of Perceived Exertion (e.g. 8.0, 9.5)
    is_warmup BOOLEAN NOT NULL DEFAULT FALSE,
    is_pr BOOLEAN NOT NULL DEFAULT FALSE,
    pr_type pr_type_enum,
    
    -- Inline historical comparison snapshot (for instant zero-friction UI rendering)
    previous_best_weight_lbs NUMERIC(6, 2),
    previous_best_reps INT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON public.workout_sets(exercise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout ON public.workout_sets(workout_id);

-- ============================================================================
-- 7. PROGRESS PHOTO VAULT (With Silhouette Alignment Metadata)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progress_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL, -- Supabase Storage bucket path
    thumbnail_path TEXT,
    pose photo_pose_enum NOT NULL DEFAULT 'front_relaxed',
    logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
    week_number INT NOT NULL DEFAULT 1,
    weight_at_time_lbs NUMERIC(5, 2),
    
    -- Alignment metadata for Ghost Overlay
    camera_aspect_ratio TEXT DEFAULT '4:3',
    device_pitch_degrees NUMERIC(4, 1), -- Phone tilt angle to replicate
    device_height_cm NUMERIC(5, 1),
    guide_silhouette_id TEXT, -- e.g. "front_athletic_male_v1"
    
    notes TEXT,
    is_baseline BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_photos_user ON public.progress_photos(user_id, logged_date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_photos_pose ON public.progress_photos(user_id, pose, logged_date DESC);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weigh_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdee_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and update only their own profile
CREATE POLICY "Users can manage own profile"
    ON public.profiles FOR ALL
    USING (auth.uid() = id);

-- Weigh-ins: Private to each user
CREATE POLICY "Users can manage own weigh-ins"
    ON public.weigh_ins FOR ALL
    USING (auth.uid() = user_id);

-- TDEE Audit Logs: Private to each user
CREATE POLICY "Users can view own tdee audits"
    ON public.tdee_audit_logs FOR ALL
    USING (auth.uid() = user_id);

-- Foods: Global foods (user_id IS NULL) readable by all, custom foods owned by user
CREATE POLICY "Public foods are viewable by all users"
    ON public.foods FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert custom foods"
    ON public.foods FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update/delete own custom foods"
    ON public.foods FOR ALL
    USING (auth.uid() = user_id);

-- Meal Logs & Templates
CREATE POLICY "Users can manage own meal logs"
    ON public.meal_logs FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own meal templates"
    ON public.meal_templates FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own meal template items"
    ON public.meal_template_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.meal_templates mt
        WHERE mt.id = meal_template_items.template_id AND mt.user_id = auth.uid()
    ));

-- Exercises & Routines: Global readable by all, custom managed by user
CREATE POLICY "Exercises viewable if public or owned"
    ON public.exercises FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can manage own exercises"
    ON public.exercises FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Routines viewable if template or owned"
    ON public.routines FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can manage own routines"
    ON public.routines FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view routine exercises"
    ON public.routine_exercises FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.routines r
        WHERE r.id = routine_exercises.routine_id AND (r.user_id IS NULL OR r.user_id = auth.uid())
    ));

-- Workouts & Workout Sets
CREATE POLICY "Users can manage own workouts"
    ON public.workouts FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own workout sets"
    ON public.workout_sets FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workouts w
        WHERE w.id = workout_sets.workout_id AND w.user_id = auth.uid()
    ));

-- Progress Photos
CREATE POLICY "Users can manage own progress photos"
    ON public.progress_photos FOR ALL
    USING (auth.uid() = user_id);

-- ============================================================================
-- 9. TRIGGERS & SEED DATA (Curated Whole Foods & Standard Split Exercises)
-- ============================================================================

-- Auto update updated_at trigger function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Seed Core Compound & Hypertrophy Exercises
INSERT INTO public.exercises (name, muscle_group, category, is_compound, default_rest_seconds) VALUES
('Barbell Flat Bench Press', 'chest', 'barbell', TRUE, 150),
('Incline Dumbbell Press', 'chest', 'dumbbell', TRUE, 120),
('Standing Overhead Barbell Press (OHP)', 'shoulders', 'barbell', TRUE, 150),
('Barbell Back Squat', 'quads', 'barbell', TRUE, 180),
('Romanian Deadlift (RDL)', 'hamstrings', 'barbell', TRUE, 150),
('Conventional Deadlift', 'back', 'barbell', TRUE, 180),
('Barbell Bent-Over Row', 'back', 'barbell', TRUE, 120),
('Weighted Pull-Up', 'back', 'weighted_bodyweight', TRUE, 120),
('Lateral Raise', 'shoulders', 'dumbbell', FALSE, 90),
('Incline Dumbbell Bicep Curl', 'biceps', 'dumbbell', FALSE, 90),
('Triceps Cable Rope Pushdown', 'triceps', 'cable', FALSE, 90),
('Leg Press', 'quads', 'machine', TRUE, 150),
('Standing Calf Raise', 'calves', 'machine', FALSE, 60)
ON CONFLICT DO NOTHING;

-- Seed Common Whole Bulking Staples
INSERT INTO public.foods (name, brand, serving_size, serving_unit, calories, protein_g, carb_g, fat_g, is_verified) VALUES
('Chicken Breast (Boneless, Cooked)', 'Whole Food', 100, 'g', 165, 31.0, 0.0, 3.6, TRUE),
('Eggs (Large, Whole)', 'Whole Food', 50, 'g', 72, 6.3, 0.4, 4.8, TRUE),
('Egg Whites', 'Whole Food', 100, 'g', 52, 11.0, 0.7, 0.2, TRUE),
('White Basmati Rice (Cooked)', 'Whole Food', 150, 'g', 195, 4.2, 43.5, 0.4, TRUE),
('Rolled Oats', 'Whole Food', 80, 'g', 303, 10.5, 54.0, 5.3, TRUE),
('Greek Yogurt 0% Fat', 'Whole Food', 170, 'g', 100, 18.0, 6.0, 0.0, TRUE),
('Whey Protein Isolate', 'Standard', 30, 'g', 120, 25.0, 2.0, 1.0, TRUE),
('Peanut Butter', 'Whole Food', 32, 'g', 190, 8.0, 7.0, 16.0, TRUE),
('Olive Oil', 'Whole Food', 14, 'g', 119, 0.0, 0.0, 13.5, TRUE),
('Banana (Medium)', 'Whole Food', 118, 'g', 105, 1.3, 27.0, 0.3, TRUE),
('Ground Beef 93/7 (Cooked)', 'Whole Food', 112, 'g', 170, 24.0, 0.0, 8.0, TRUE)
ON CONFLICT DO NOTHING;
