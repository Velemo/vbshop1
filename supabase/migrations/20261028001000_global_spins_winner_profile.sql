DROP FUNCTION IF EXISTS public.global_spins();

CREATE FUNCTION public.global_spins()
RETURNS TABLE (
  label text,
  image_url text,
  created_at timestamptz,
  winner_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    rs.label::text,
    rs.image_url::text,
    rs.created_at,
    COALESCE(
      NULLIF(BTRIM(u.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(BTRIM(u.raw_user_meta_data ->> 'name'), ''),
      'Vencedor'
    ) AS winner_name,
    COALESCE(
      NULLIF(BTRIM(u.raw_user_meta_data ->> 'avatar_url'), ''),
      NULLIF(BTRIM(u.raw_user_meta_data ->> 'picture'), '')
    ) AS avatar_url
  FROM public.roulette_spins AS rs
  LEFT JOIN auth.users AS u ON u.id = rs.user_id
  ORDER BY rs.created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.global_spins() TO authenticated;
