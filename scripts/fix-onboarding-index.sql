-- Fix onboarding_progress unique index
-- This script ensures the unique index exists for ON CONFLICT to work

-- Check if index exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'onboarding_progress_business_user_idx'
        AND tablename = 'onboarding_progress'
    ) THEN
        CREATE UNIQUE INDEX onboarding_progress_business_user_idx
        ON onboarding_progress (business_id, user_id);
        RAISE NOTICE 'Created unique index onboarding_progress_business_user_idx';
    ELSE
        RAISE NOTICE 'Index onboarding_progress_business_user_idx already exists';
    END IF;
END $$;

