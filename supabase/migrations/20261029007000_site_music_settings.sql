CREATE TABLE IF NOT EXISTS public.site_music_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  music_url text,
  music_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.site_music_settings (id, music_url, music_name)
VALUES (1, NULL, NULL) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_music_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read site music settings" ON public.site_music_settings;
CREATE POLICY "Anyone can read site music settings" ON public.site_music_settings
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage site music settings" ON public.site_music_settings;
CREATE POLICY "Admins manage site music settings" ON public.site_music_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.site_music_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_music_settings TO authenticated;
