import { NavLink } from "react-router-dom";
import { Store, Disc3, Mail, UserRound } from "lucide-react";

const links = [
  { to: "/", label: "Loja", icon: Store, end: true },
  { to: "/roleta", label: "ROLETA", icon: Disc3, end: false },
  { to: "/correio", label: "Correio", icon: Mail, end: false },
  { to: "/perfil", label: "PERFIL", icon: UserRound, end: false },
];

const BottomNav = () => (
  <nav aria-label="Navegação principal" className="shrink-0 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
    <div className="mx-auto flex max-w-lg items-stretch justify-around">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} aria-label={label} title={label} className={({ isActive }) => `flex min-w-0 flex-1 items-center justify-center h-14 transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Icon size={23} aria-hidden="true" />
        </NavLink>
      ))}
    </div>
  </nav>
);

export default BottomNav;