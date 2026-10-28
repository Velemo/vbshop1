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
SET search_path = public
AS $$
  SELECT
    rs.label::text,
    rs.image_url::text,
    rs.created_at,
    COALESCE(NULLIF(BTRIM(p.display_name), ''), 'Vencedor') AS winner_name,
    NULLIF(BTRIM(p.avatar_url), '') AS avatar_url
  FROM public.roulette_spins AS rs
  LEFT JOIN public.profiles AS p ON p.user_id = rs.user_id
  ORDER BY rs.created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.global_spins() TO authenticated;
