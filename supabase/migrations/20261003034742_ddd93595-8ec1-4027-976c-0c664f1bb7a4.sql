ALTER TABLE public.roulette_slots ADD COLUMN prize_text text NOT NULL DEFAULT '', ADD COLUMN prize_link text, ADD COLUMN prize_video_url text;
CREATE TABLE public.prize_mail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  position integer NOT NULL,
  label text NOT NULL DEFAULT '',
  image_url text,
  prize_text text NOT NULL DEFAULT '',
  prize_link text,
  prize_video_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prize_mail TO authenticated;
GRANT ALL ON public.prize_mail TO service_role;
ALTER TABLE public.prize_mail ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipients see own prize mail" ON public.prize_mail FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER prize_mail_updated BEFORE UPDATE ON public.prize_mail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.spin_roulette() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE w public.wallets; p int; s public.roulette_slots;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR w.tickets < 1 THEN RAISE EXCEPTION 'Sem bilhetes'; END IF;
  p := floor(random()*10)::int;
  SELECT * INTO s FROM public.roulette_slots WHERE position = p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prémio indisponível'; END IF;
  UPDATE public.wallets SET tickets = tickets - 1, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.roulette_spins(user_id, position, label, image_url) VALUES (auth.uid(), p, coalesce(s.label,''), s.image_url);
  INSERT INTO public.prize_mail(user_id, position, label, image_url, prize_text, prize_link, prize_video_url)
  VALUES (auth.uid(), p, coalesce(s.label,''), s.image_url, coalesce(s.prize_text,''), s.prize_link, s.prize_video_url);
  RETURN p;
END $function$;