CREATE TABLE public.roulette_settings (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), reset_at timestamptz NOT NULL DEFAULT '1970-01-01', updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.roulette_settings TO authenticated;
GRANT ALL ON public.roulette_settings TO service_role;
ALTER TABLE public.roulette_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads roulette settings" ON public.roulette_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
INSERT INTO public.roulette_settings(id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.roulette_rules ADD COLUMN IF NOT EXISTS discount_percent integer, ADD COLUMN IF NOT EXISTS discount_days integer;

CREATE TABLE public.user_contacts (
  user_id uuid PRIMARY KEY,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  name_changed_at timestamptz NOT NULL DEFAULT now(),
  phone_changed_at timestamptz NOT NULL DEFAULT now(),
  email_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_contacts TO authenticated;
GRANT ALL ON public.user_contacts TO service_role;
ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin reads contacts" ON public.user_contacts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.save_contact(_name text, _phone text, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.user_contacts; n text := trim(coalesce(_name,'')); ph text := trim(coalesce(_phone,'')); em text := lower(trim(coalesce(_email,'')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  IF length(n) < 2 OR length(n) > 80 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  IF ph !~ '^\+?[0-9 ]{7,20}$' THEN RAISE EXCEPTION 'Número de contacto inválido'; END IF;
  IF em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(em) > 255 THEN RAISE EXCEPTION 'E-mail inválido'; END IF;
  SELECT * INTO c FROM public.user_contacts WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.user_contacts(user_id, full_name, phone, email) VALUES (auth.uid(), n, ph, em);
    RETURN;
  END IF;
  IF n <> c.full_name AND c.name_changed_at > now() - interval '30 days' THEN
    RAISE EXCEPTION 'O nome só pode ser alterado a partir de %', to_char(c.name_changed_at + interval '30 days','DD/MM/YYYY HH24:MI'); END IF;
  IF ph <> c.phone AND c.phone_changed_at > now() - interval '15 days' THEN
    RAISE EXCEPTION 'O contacto só pode ser alterado a partir de %', to_char(c.phone_changed_at + interval '15 days','DD/MM/YYYY HH24:MI'); END IF;
  IF em <> c.email AND c.email_changed_at > now() - interval '15 days' THEN
    RAISE EXCEPTION 'O e-mail só pode ser alterado a partir de %', to_char(c.email_changed_at + interval '15 days','DD/MM/YYYY HH24:MI'); END IF;
  UPDATE public.user_contacts SET
    full_name = n, phone = ph, email = em,
    name_changed_at = CASE WHEN n <> c.full_name THEN now() ELSE name_changed_at END,
    phone_changed_at = CASE WHEN ph <> c.phone THEN now() ELSE phone_changed_at END,
    email_changed_at = CASE WHEN em <> c.email THEN now() ELSE email_changed_at END
  WHERE user_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.admin_reset_roulette()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso reservado ao administrador' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.roulette_rules ORDER BY position FOR UPDATE;
  UPDATE public.roulette_settings SET reset_at = now(), updated_at = now() WHERE id = 1;
  UPDATE public.roulette_rules SET goal_counter = 0 WHERE goal_counter <> 0;
END $$;

CREATE OR REPLACE FUNCTION public.admin_roulette_stats()
RETURNS TABLE(user_id uuid, user_code text, display_name text, avatar_url text, full_name text, phone text, email text, spins bigint, wins_total bigint, last_spin timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ra timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso reservado ao administrador' USING ERRCODE='42501'; END IF;
  SELECT reset_at INTO ra FROM public.roulette_settings WHERE id = 1;
  RETURN QUERY
  SELECT u.uid, p.user_code, nullif(p.display_name,''), nullif(p.avatar_url,''), c.full_name, c.phone, c.email,
    (SELECT count(*) FROM public.roulette_spins s WHERE s.user_id = u.uid AND s.created_at > coalesce(ra,'1970-01-01')),
    (SELECT count(*) FROM public.roulette_spins s WHERE s.user_id = u.uid),
    (SELECT max(s.created_at) FROM public.roulette_spins s WHERE s.user_id = u.uid)
  FROM (SELECT DISTINCT s.user_id AS uid FROM public.roulette_spins s UNION SELECT uc.user_id FROM public.user_contacts uc) u
  LEFT JOIN public.profiles p ON p.user_id = u.uid
  LEFT JOIN public.user_contacts c ON c.user_id = u.uid
  ORDER BY 8 DESC, 10 DESC NULLS LAST;
END $$;

CREATE OR REPLACE FUNCTION public.spin_roulette()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w public.wallets; p int; s public.roulette_slots; c public.roulette_prize_content;
  r public.roulette_rules; u int; total numeric; pick numeric; acc numeric := 0; ra timestamptz;
  win public.roulette_rules; dcode text; ptext text; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_contacts WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Preencha o nome, contacto e e-mail antes de girar'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR w.tickets < 1 THEN RAISE EXCEPTION 'Sem bilhetes'; END IF;
  INSERT INTO public.roulette_rules(position) SELECT position FROM public.roulette_slots ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.roulette_rules ORDER BY position FOR UPDATE;
  SELECT reset_at INTO ra FROM public.roulette_settings WHERE id = 1;
  SELECT count(*) INTO u FROM public.roulette_spins WHERE user_id = auth.uid() AND created_at > coalesce(ra,'1970-01-01');
  UPDATE public.roulette_rules SET goal_counter = goal_counter + 1 WHERE enabled AND mode = 'goal';
  p := NULL;
  SELECT * INTO r FROM public.roulette_rules WHERE enabled AND mode='eligible' AND eligible_active AND u >= min_user_spins ORDER BY position LIMIT 1;
  IF FOUND THEN
    p := r.position;
    UPDATE public.roulette_rules SET eligible_active = false WHERE position = p;
  ELSE
    SELECT * INTO r FROM public.roulette_rules WHERE enabled AND mode='goal' AND goal_counter >= goal_spins AND u >= min_user_spins ORDER BY position LIMIT 1;
    IF FOUND THEN
      p := r.position;
      IF r.deliveries_done + 1 >= r.deliveries_total THEN
        UPDATE public.roulette_rules SET deliveries_done = 0, goal_counter = 0 WHERE position = p;
      ELSE
        UPDATE public.roulette_rules SET deliveries_done = deliveries_done + 1 WHERE position = p;
      END IF;
    END IF;
  END IF;
  IF p IS NULL THEN
    SELECT coalesce(sum(weight),0) INTO total FROM public.roulette_rules WHERE enabled AND mode='percent' AND weight > 0;
    IF total <= 0 THEN RAISE EXCEPTION 'Nenhum prémio disponível de momento'; END IF;
    pick := random() * total;
    FOR r IN SELECT * FROM public.roulette_rules WHERE enabled AND mode='percent' AND weight > 0 ORDER BY position LOOP
      acc := acc + r.weight;
      IF pick < acc THEN p := r.position; EXIT; END IF;
    END LOOP;
    IF p IS NULL THEN p := r.position; END IF;
  END IF;
  SELECT * INTO s FROM public.roulette_slots WHERE position = p;
  SELECT * INTO c FROM public.roulette_prize_content WHERE position = p;
  SELECT * INTO win FROM public.roulette_rules WHERE position = p;
  ptext := coalesce(c.prize_text,'');
  IF win.discount_percent IS NOT NULL AND win.discount_percent BETWEEN 1 AND 100 THEN
    LOOP
      dcode := 'DS-';
      FOR i IN 1..12 LOOP
        dcode := dcode || substr(chars, 1 + floor(random()*32)::int, 1);
        IF i IN (4,8) THEN dcode := dcode || '-'; END IF;
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.discount_codes WHERE code = dcode);
    END LOOP;
    INSERT INTO public.discount_codes(code, percent, expires_at)
    VALUES (dcode, win.discount_percent, CASE WHEN win.discount_days > 0 THEN now() + make_interval(days => win.discount_days) END);
    ptext := 'Código de desconto ' || win.discount_percent || '%: ' || dcode
      || CASE WHEN win.discount_days > 0 THEN E'\nVálido até ' || to_char(now() + make_interval(days => win.discount_days),'DD/MM/YYYY') ELSE '' END
      || CASE WHEN ptext <> '' THEN E'\n\n' || ptext ELSE '' END;
  END IF;
  UPDATE public.wallets SET tickets = tickets - 1, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.roulette_spins(user_id, position, label, image_url) VALUES (auth.uid(), p, coalesce(s.label,''), s.image_url);
  INSERT INTO public.prize_mail(user_id, position, label, image_url, prize_text, prize_link, prize_video_url)
  VALUES (auth.uid(), p, coalesce(s.label,''), s.image_url, ptext, c.prize_link, c.prize_video_url);
  RETURN p;
END $function$;