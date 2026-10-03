CREATE TABLE public.roulette_prize_content (
 position integer PRIMARY KEY REFERENCES public.roulette_slots(position),
 prize_text text NOT NULL DEFAULT '',
 prize_link text,
 prize_video_url text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roulette_prize_content TO authenticated;
GRANT ALL ON public.roulette_prize_content TO service_role;
ALTER TABLE public.roulette_prize_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages prize content" ON public.roulette_prize_content FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER roulette_prize_content_updated BEFORE UPDATE ON public.roulette_prize_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.spin_roulette() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE w public.wallets; p int; s public.roulette_slots; c public.roulette_prize_content;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR w.tickets < 1 THEN RAISE EXCEPTION 'Sem bilhetes'; END IF;
  p := floor(random()*10)::int;
  SELECT * INTO s FROM public.roulette_slots WHERE position = p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prémio indisponível'; END IF;
  SELECT * INTO c FROM public.roulette_prize_content WHERE position = p;
  UPDATE public.wallets SET tickets = tickets - 1, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.roulette_spins(user_id, position, label, image_url) VALUES (auth.uid(), p, coalesce(s.label,''), s.image_url);
  INSERT INTO public.prize_mail(user_id, position, label, image_url, prize_text, prize_link, prize_video_url)
  VALUES (auth.uid(), p, coalesce(s.label,''), s.image_url, coalesce(c.prize_text,''), c.prize_link, c.prize_video_url);
  RETURN p;
END $function$;