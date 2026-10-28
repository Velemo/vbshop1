-- vb$ transfers and P2P marketplace
CREATE TABLE IF NOT EXISTS public.p2p_authorized_sellers (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 authorized_by uuid REFERENCES auth.users(id), authorized_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.p2p_authorized_sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view seller authorization" ON public.p2p_authorized_sellers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage seller authorization" ON public.p2p_authorized_sellers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TABLE IF NOT EXISTS public.p2p_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 amount_vb numeric(12,2) NOT NULL CHECK(amount_vb>0), price_mt numeric(12,2) NOT NULL CHECK(price_mt>0),
 payment_method text NOT NULL CHECK(payment_method IN ('M-Pesa','e-Mola')), payment_details text NOT NULL,
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.p2p_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view active P2P offers" ON public.p2p_offers FOR SELECT TO authenticated USING (is_active OR seller_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "authorized sellers create offers" ON public.p2p_offers FOR INSERT TO authenticated WITH CHECK (seller_id=auth.uid() AND EXISTS(SELECT 1 FROM public.p2p_authorized_sellers s WHERE s.user_id=auth.uid()));
CREATE POLICY "authorized sellers update offers" ON public.p2p_offers FOR UPDATE TO authenticated USING (seller_id=auth.uid() AND EXISTS(SELECT 1 FROM public.p2p_authorized_sellers s WHERE s.user_id=auth.uid())) WITH CHECK(seller_id=auth.uid());
GRANT SELECT,INSERT,UPDATE ON public.p2p_offers TO authenticated;
CREATE TABLE IF NOT EXISTS public.p2p_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid NOT NULL REFERENCES public.p2p_offers(id),
 buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 payment_method text NOT NULL CHECK(payment_method IN ('M-Pesa','e-Mola')), payment_reference text,
 status text NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','payment_reported','completed','cancelled','disputed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.p2p_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyers sellers admins view orders" ON public.p2p_orders FOR SELECT TO authenticated USING(buyer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.p2p_offers o WHERE o.id=offer_id AND o.seller_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "buyers create orders" ON public.p2p_orders FOR INSERT TO authenticated WITH CHECK(buyer_id=auth.uid() AND EXISTS(SELECT 1 FROM public.p2p_offers o WHERE o.id=offer_id AND o.is_active=true AND o.seller_id<>auth.uid()));
CREATE POLICY "buyers report payment" ON public.p2p_orders FOR UPDATE TO authenticated USING(buyer_id=auth.uid() AND status='pending_payment') WITH CHECK(buyer_id=auth.uid() AND status='payment_reported');
GRANT SELECT,INSERT,UPDATE ON public.p2p_orders TO authenticated;
CREATE OR REPLACE FUNCTION public.transfer_vb(_recipient_user_id uuid,_amount numeric) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sender_balance numeric; recipient_balance numeric;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para enviar vb$'; END IF;
 IF _recipient_user_id IS NULL OR _recipient_user_id=auth.uid() THEN RAISE EXCEPTION 'Destinatário inválido'; END IF;
 IF _amount IS NULL OR _amount<=0 OR _amount>100000000 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
 PERFORM 1 FROM public.wallets WHERE user_id IN(auth.uid(),_recipient_user_id) ORDER BY user_id FOR UPDATE;
 SELECT balance INTO sender_balance FROM public.wallets WHERE user_id=auth.uid();
 IF sender_balance IS NULL OR sender_balance<_amount THEN RAISE EXCEPTION 'Saldo vb$ insuficiente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=_recipient_user_id) THEN RAISE EXCEPTION 'Destinatário não encontrado'; END IF;
 INSERT INTO public.wallets(user_id,balance) VALUES(_recipient_user_id,0) ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.wallets SET balance=balance-_amount,updated_at=now() WHERE user_id=auth.uid();
 UPDATE public.wallets SET balance=balance+_amount,updated_at=now() WHERE user_id=_recipient_user_id RETURNING balance INTO recipient_balance;
 RETURN recipient_balance;
END $$;
REVOKE EXECUTE ON FUNCTION public.transfer_vb(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_vb(uuid,numeric) TO authenticated;
