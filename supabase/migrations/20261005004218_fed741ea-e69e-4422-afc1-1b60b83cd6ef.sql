CREATE TABLE public.roulette_rules (
  position integer PRIMARY KEY REFERENCES public.roulette_slots(position) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'percent' CHECK (mode IN ('percent','goal','eligible')),
  weight numeric NOT NULL DEFAULT 10 CHECK (weight >= 0),
  goal_spins integer NOT NULL DEFAULT 50 CHECK (goal_spins >= 1),
  goal_counter integer NOT NULL DEFAULT 0,
  min_user_spins integer NOT NULL DEFAULT 0 CHECK (min_user_spins >= 0),
  deliveries_total integer NOT NULL DEFAULT 1 CHECK (deliveries_total >= 1),
  deliveries_done integer NOT NULL DEFAULT 0,
  eligible_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roulette_rules TO authenticated;
GRANT ALL ON public.roulette_rules TO service_role;
ALTER TABLE public.roulette_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages roulette rules" ON public.roulette_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER roulette_rules_updated BEFORE UPDATE ON public.roulette_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.spin_roulette()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w public.wallets; p int; s public.roulette_slots; c public.roulette_prize_content;
  r public.roulette_rules; u int; total numeric; pick numeric; acc numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR w.tickets < 1 THEN RAISE EXCEPTION 'Sem bilhetes'; END IF;
  -- ensure a rule row per slot, then lock all rules (serializes concurrent spins)
  INSERT INTO public.roulette_rules(position) SELECT position FROM public.roulette_slots ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.roulette_rules ORDER BY position FOR UPDATE;
  SELECT count(*) INTO u FROM public.roulette_spins WHERE user_id = auth.uid();
  UPDATE public.roulette_rules SET goal_counter = goal_counter + 1 WHERE enabled AND mode = 'goal';
  p := NULL;
  -- 4. eligible-user prize
  SELECT * INTO r FROM public.roulette_rules WHERE enabled AND mode='eligible' AND eligible_active AND u >= min_user_spins ORDER BY position LIMIT 1;
  IF FOUND THEN
    p := r.position;
    UPDATE public.roulette_rules SET eligible_active = false WHERE position = p;
  ELSE
    -- 2. goal prize
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
  -- 3. weighted percentage among enabled percent prizes
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
  UPDATE public.wallets SET tickets = tickets - 1, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.roulette_spins(user_id, position, label, image_url) VALUES (auth.uid(), p, coalesce(s.label,''), s.image_url);
  INSERT INTO public.prize_mail(user_id, position, label, image_url, prize_text, prize_link, prize_video_url)
  VALUES (auth.uid(), p, coalesce(s.label,''), s.image_url, coalesce(c.prize_text,''), c.prize_link, c.prize_video_url);
  RETURN p;
END $function$;