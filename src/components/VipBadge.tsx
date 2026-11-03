import { Crown } from "lucide-react";

const VipBadge = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500 ${className}`}>
    <Crown size={10} className="fill-amber-400 text-amber-400" /> VIP
  </span>
);

export default VipBadge;
