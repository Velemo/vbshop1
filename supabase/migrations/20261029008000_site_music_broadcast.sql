CREATE TABLE IF NOT EXISTS public.site_music_broadcast (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  music_url text,
  music_name text,
  is_playing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.site_music_broadcast (id, music_url, music_name, is_playing)
VALUES (1, NULL, NULL, false) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.site_music_broadcast ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read site music broadcast" ON public.site_music_broadcast;
CREATE POLICY "Anyone can read site music broadcast" ON public.site_music_broadcast
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage site music broadcast" ON public.site_music_broadcast;
CREATE POLICY "Admins manage site music broadcast" ON public.site_music_broadcast
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.site_music_broadcast TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_music_broadcast TO authenticated;
