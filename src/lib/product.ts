export type Product = {
  id: string;
  name: string;
  description: string;
  category?: string;
  image_url: string | null;
  gallery: any;
  price: number;
  promo_price: number | null;
  promo_ends_at: string | null;
  stock: number;
  seller_whatsapp: string;
  created_at: string;
  updated_at: string;
};

export const activePrice = (p: Pick<Product, "price" | "promo_price" | "promo_ends_at">) => {
  if (p.promo_price != null && p.promo_ends_at && new Date(p.promo_ends_at) > new Date()) {
    return { price: Number(p.promo_price), promo: true, original: Number(p.price) };
  }
  return { price: Number(p.price), promo: false, original: Number(p.price) };
};

export const formatMt = (v: number) =>
  new Intl.NumberFormat("pt-MZ", { style: "currency", currency: "MZN", maximumFractionDigits: 0 }).format(v);

export const whatsappLink = (phone: string, productName: string) => {
  const cleaned = (phone || "").replace(/\D/g, "");
  const msg = encodeURIComponent(`Olá! Tenho interesse no produto: ${productName}`);
  return `https://wa.me/${cleaned}?text=${msg}`;
};