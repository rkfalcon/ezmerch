-- Harden the custom access token hook with error handling
-- If the role lookup fails for any reason, return a default 'customer' claim
-- instead of crashing the entire auth request with a 500

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_role public.app_role;
BEGIN
  claims := event->'claims';

  BEGIN
    SELECT role INTO user_role FROM public.user_roles
    WHERE user_id = (event->>'user_id')::uuid
    ORDER BY CASE role
      WHEN 'admin' THEN 1
      WHEN 'store_owner' THEN 2
      WHEN 'customer' THEN 3
    END
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    user_role := NULL;
  END;

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', '"customer"');
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;
