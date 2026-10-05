-- Prior sends alone are not evidence of consent. Existing and future profiles
-- start unsubscribed from weekly briefs. Daily/marketing preferences are untouched.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN weekly_email_opt_in boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.weekly_email_opt_in IS 'Explicit consent for weekly training briefs; independent of daily and marketing preferences.';
COMMIT;
