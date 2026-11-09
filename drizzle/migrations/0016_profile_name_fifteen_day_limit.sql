ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name_changed_at timestamptz;
COMMENT ON COLUMN public.profiles.name_changed_at IS 'Server-managed timestamp of the last displayed-name change; 15-day cooldown.';
CREATE OR REPLACE FUNCTION public.guard_profile_name_change() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   NEW.name_changed_at := NULL;
 ELSIF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
   IF length(trim(coalesce(NEW.display_name,''))) < 2 OR length(trim(NEW.display_name)) > 80 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
   IF OLD.name_changed_at IS NOT NULL AND OLD.name_changed_at + interval '15 days' > now() THEN
     RAISE EXCEPTION 'O nome só pode ser alterado a partir de %', to_char(OLD.name_changed_at + interval '15 days','DD/MM/YYYY HH24:MI');
   END IF;
   NEW.display_name := trim(NEW.display_name);
   NEW.name_changed_at := now();
 ELSE
   NEW.name_changed_at := OLD.name_changed_at;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_profile_name_change BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_name_change();
CREATE OR REPLACE FUNCTION public.save_contact(_name text, _phone text, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.user_contacts; n text := trim(coalesce(_name,'')); ph text := trim(coalesce(_phone,'')); em text := lower(trim(coalesce(_email,'')));
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF length(n) < 2 OR length(n) > 80 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
 IF ph !~ '^\+?[0-9 ]{7,20}$' THEN RAISE EXCEPTION 'Número de contacto inválido'; END IF;
 IF em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(em) > 255 THEN RAISE EXCEPTION 'E-mail inválido'; END IF;
 SELECT * INTO c FROM public.user_contacts WHERE user_id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO public.user_contacts(user_id, full_name, phone, email) VALUES (auth.uid(), n, ph, em); RETURN;
 END IF;
 IF n <> c.full_name AND c.name_changed_at > now() - interval '15 days' THEN RAISE EXCEPTION 'O nome só pode ser alterado a partir de %', to_char(c.name_changed_at + interval '15 days','DD/MM/YYYY HH24:MI'); END IF;
 IF ph <> c.phone AND c.phone_changed_at > now() - interval '15 days' THEN RAISE EXCEPTION 'O contacto só pode ser alterado a partir de %', to_char(c.phone_changed_at + interval '15 days','DD/MM/YYYY HH24:MI'); END IF;
 IF em <> c.email AND c.email_changed_at > now() - interval '15 days' THEN RAISE EXCEPTION 'O e-mail só pode ser alterado a partir de %', to_char(c.email_changed_at + interval '15 days','DD/MM/YYYY HH24:MI'); END IF;
 UPDATE public.user_contacts SET full_name = n, phone = ph, email = em,
 name_changed_at = CASE WHEN n <> c.full_name THEN now() ELSE name_changed_at END,
 phone_changed_at = CASE WHEN ph <> c.phone THEN now() ELSE phone_changed_at END,
 email_changed_at = CASE WHEN em <> c.email THEN now() ELSE email_changed_at END WHERE user_id = auth.uid();
END $$;