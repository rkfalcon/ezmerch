-- Add claimed_at timestamp to stores
ALTER TABLE public.stores ADD COLUMN claimed_at timestamptz;

-- Update the claim_store function to set claimed_at
CREATE OR REPLACE FUNCTION public.claim_store(p_token text, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  -- Find unclaimed store with valid, non-expired token
  SELECT id INTO v_store_id
  FROM public.stores
  WHERE claim_token = p_token
    AND claimed = false
    AND (claim_token_expires_at IS NULL OR claim_token_expires_at > now())
  FOR UPDATE;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired claim token';
  END IF;

  -- Bind store to user
  UPDATE public.stores
  SET owner_id = p_user_id,
      claimed = true,
      claimed_at = now(),
      claim_token = NULL,
      claim_token_expires_at = NULL,
      updated_at = now()
  WHERE id = v_store_id;

  -- Add store_owner role
  INSERT INTO public.user_roles (user_id, role, store_id)
  VALUES (p_user_id, 'store_owner', v_store_id)
  ON CONFLICT (user_id, role, store_id) DO NOTHING;

  RETURN v_store_id;
END;
$$;

-- Backfill claimed_at for already-claimed stores
UPDATE public.stores SET claimed_at = updated_at WHERE claimed = true AND claimed_at IS NULL;
