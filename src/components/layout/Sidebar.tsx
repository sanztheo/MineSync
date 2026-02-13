import type { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  Gamepad2,
  Package,
  RefreshCw,
  Settings,
  type LucideIcon,
  User,
} from "lucide-react";

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
}

const NAV_ITEMS: readonly NavItemProps[] = [
  { to: "/", icon: Gamepad2, label: "Home" },
  { to: "/mods", icon: Package, label: "Browse Mods" },
  { to: "/sync", icon: RefreshCw, label: "Sync Hub" },
] as const;

function NavItem({ to, icon: Icon, label }: NavItemProps): ReactNode {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-accent-muted text-accent"
            : "text-zinc-400 hover:bg-surface-600 hover:text-zinc-200"
        }`
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

function PlayerBadge(): ReactNode {
  return (
    <Link
      to="/auth"
      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-600"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-600">
        <User size={16} className="text-zinc-400" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-zinc-300">Player</span>
        <span className="text-[10px] text-zinc-600">Not signed in</span>
      </div>
    </Link>
  );
}

export function Sidebar(): ReactNode {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border-default bg-surface-800">
      {/* Main navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col gap-0.5 border-t border-border-default p-3">
        <NavItem to="/settings" icon={Settings} label="Settings" />
        <PlayerBadge />
      </div>
    </aside>
  );
}
