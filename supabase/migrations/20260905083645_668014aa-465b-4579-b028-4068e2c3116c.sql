
CREATE TABLE public.announcements (
  id uuid primary key default gen_random_uuid(),
  media_url text,
  media_type text not null default 'image',
  title text,
  subtitle text,
  button_label text,
  button_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can view announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "admins manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) LIKE 'campionatovbtvff@gmail.com%'
ON CONFLICT (user_id, role) DO NOTHING;
