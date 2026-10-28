ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Mais';

ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE public.products
ADD CONSTRAINT products_category_check
CHECK (category IN ('MODs', 'Jogos', 'Eletrónicos', 'Pro Digital', 'Mais'));
