import { NavLink } from "react-router-dom";
import { Store, Disc3, UserRound } from "lucide-react";

const links = [
  { to: "/", label: "Loja", icon: Store, end: true },
  { to: "/roleta", label: "ROLETA", icon: Disc3, end: false },
  { to: "/perfil", label: "PERFIL", icon: UserRound, end: false },
];

const BottomNav = () => (
  <nav aria-label="Navegação principal" className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
    <div className="mx-auto flex max-w-lg items-stretch justify-around">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Icon size={21} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  </nav>
);

export default BottomNav;