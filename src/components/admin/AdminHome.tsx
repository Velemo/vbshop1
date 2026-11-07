import { ArrowLeftRight, BarChart3, CircleDollarSign, Dices, Image, MessageSquareText, Music, Package, Ticket, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export type AdminTab = "products" | "users" | "visits" | "ad" | "roleta" | "codes" | "p2p" | "wallet";
export const adminFunctions = [
  { id: "products", label: "Produtos", icon: Package },
  { id: "roleta", label: "Roleta", icon: Dices },
  { id: "ad", label: "Anúncios", icon: Image },
  { id: "users", label: "Utilizadores", icon: Users },
  { id: "p2p", label: "P2P", icon: ArrowLeftRight },
  { id: "wallet", label: "Carteira do Site", icon: CircleDollarSign },
  { id: "codes", label: "Códigos", icon: Ticket },
  { id: "visits", label: "Visitantes", icon: BarChart3 },
] as const;

export default function AdminHome({ onSelect, onMusic }: { onSelect: (tab: AdminTab) => void; onMusic: () => void }) {
  const tile = "h-36 flex-col gap-4 whitespace-normal rounded-lg border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent [&_svg]:size-8";
  return <section>
    <h2 className="mb-6 font-display text-2xl font-semibold">Administração</h2>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {adminFunctions.map(({ id, label, icon: Icon }) => <Button key={id} variant="outline" className={tile} onClick={() => onSelect(id)}><Icon className="text-primary" strokeWidth={1.5} /><span>{label}</span></Button>)}
      <Button variant="outline" asChild className={tile}><Link to="/pedidos"><MessageSquareText className="text-primary" strokeWidth={1.5} /><span>Pedidos</span></Link></Button>
      <Button variant="outline" className={tile} onClick={onMusic}><Music className="text-primary" strokeWidth={1.5} /><span>Música do Site</span></Button>
    </div>
  </section>;
}