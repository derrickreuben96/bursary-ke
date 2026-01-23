-- Add new roles to the app_role enum (must be separate transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'county_treasury';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'county_commissioner';