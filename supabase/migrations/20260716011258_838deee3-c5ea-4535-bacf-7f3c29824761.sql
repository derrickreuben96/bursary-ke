-- Restore EXECUTE on public.has_role to anon so RLS policies that reference
-- it degrade to `false` for unauthenticated requests instead of raising
-- "permission denied for function has_role" from PostgREST. has_role is a
-- SECURITY DEFINER, STABLE function that only reads user_roles and returns
-- a boolean — it exposes no PII and cannot be used to enumerate roles
-- (caller must already know the target user_id).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;