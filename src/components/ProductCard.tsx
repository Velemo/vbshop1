import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Product, activePrice, formatMt } from "@/lib/product";

type Props = {
  product: Product;
  inWishlist?: boolean;
  onToggleWishlist?: () => void;
};

const ProductCard = ({ product, inWishlist, onToggleWishlist }: Props) => {
  const { price, promo, original } = activePrice(product);
  return (
    <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all">
      <Link to={`/product/${product.id}`} className="block relative aspect-square bg-muted overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy"
               className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"/>
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">sem imagem</div>
        )}
        {promo && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground">
            PROMO
          </span>
        )}
        {onToggleWishlist && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onToggleWishlist(); }}
            className="absolute top-2 right-2 p-2 rounded-full bg-background/90 backdrop-blur hover:bg-background shadow-sm"
            aria-label="Lista de desejos"
          >
            <Heart size={16} className={inWishlist ? "fill-destructive text-destructive" : "text-foreground"} />
          </button>
        )}
      </Link>
      <div className="p-3 space-y-1">
        <Link to={`/product/${product.id}`} className="block text-sm font-medium text-foreground line-clamp-2 leading-snug min-h-[2.5rem]">
          {product.name}
        </Link>
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-base font-display font-bold text-foreground">{formatMt(price)}</span>
          {promo && <span className="text-xs text-muted-foreground line-through">{formatMt(original)}</span>}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;