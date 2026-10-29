-- Public user IDs: mv + eight digits.
-- The administrator receives the first ID, then existing accounts are ordered by creation time.
CREATE SEQUENCE IF NOT EXISTS public.user_code_seq START WITH 1;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_code text;

WITH ranked_users AS (
  SELECT
    id AS user_id,
    email,
    row_number() OVER (
      ORDER BY
        CASE WHEN lower(email) = 'campionatovbtvff@gmail.com' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS id_number
  FROM auth.users
)
INSERT INTO public.profiles (user_id, email, user_code)
SELECT user_id, email, 'mv' || lpad(id_number::text, 8, '0')
FROM ranked_users
ON CONFLICT (user_id) DO UPDATE
SET email = COALESCE(EXCLUDED.email, public.profiles.email),
    user_code = COALESCE(public.profiles.user_code, EXCLUDED.user_code);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_code_unique
  ON public.profiles (user_code)
  WHERE user_code IS NOT NULL;

SELECT setval(
  'public.user_code_seq',
  GREATEST(
    COALESCE((SELECT MAX(substring(user_code FROM 3)::bigint) FROM public.profiles WHERE user_code ~ '^mv[0-9]{8}$'), 1),
    1
  ),
  true
);

CREATE OR REPLACE FUNCTION public.assign_user_code_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, user_code)
  VALUES (
    NEW.id,
    NEW.email,
    'mv' || lpad(nextval('public.user_code_seq')::text, 8, '0')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.profiles.email),
        user_code = COALESCE(public.profiles.user_code, EXCLUDED.user_code);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_user_code_after_signup ON auth.users;
CREATE TRIGGER assign_user_code_after_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_user_code_on_signup();
