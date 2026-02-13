import { type ReactNode, useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  Home,
  Search,
  Layers,
  RefreshCw,
  Settings,
  type LucideIcon,
  User,
} from "lucide-react";
import { getProfile } from "@/lib/tauri";
import type { MinecraftProfile } from "@/lib/types";

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
}

const NAV_ITEMS: readonly NavItemProps[] = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/mods", icon: Search, label: "Browse Mods" },
  { to: "/modpacks", icon: Layers, label: "Modpacks" },
  { to: "/sync", icon: RefreshCw, label: "Sync Hub" },
] as const;

function NavItem({ to, icon: Icon, label }: NavItemProps): ReactNode {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ${
          isActive
            ? "bg-[rgba(55,53,47,0.08)] font-medium text-[rgba(55,53,47,1)]"
            : "font-normal text-[rgba(55,53,47,0.65)] hover:bg-[rgba(55,53,47,0.04)]"
        }`
      }
    >
      <Icon size={18} strokeWidth={1.8} />
      <span>{label}</span>
    </NavLink>
  );
}

const SKIN_BASE_URL = "https://mc-heads.net/avatar";

function PlayerBadge(): ReactNode {
  const [profile, setProfile] = useState<MinecraftProfile | undefined>(
    undefined,
  );

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const p = await getProfile();
        setProfile(p);
      } catch {
        // No profile yet
      }
    };
    load();

    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      to="/auth"
      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors duration-150 hover:bg-[rgba(55,53,47,0.04)]"
    >
      {profile !== undefined ? (
        <img
          src={`${SKIN_BASE_URL}/${profile.uuid}/28`}
          alt={profile.username}
          width={28}
          height={28}
          className="h-7 w-7 rounded-md"
        />
      ) : (
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ background: "rgba(55, 53, 47, 0.08)" }}
        >
          <User size={14} style={{ color: "rgba(55, 53, 47, 0.45)" }} />
        </div>
      )}
      <div className="flex flex-col">
        <span
          className="text-sm font-medium"
          style={{ color: "rgba(55, 53, 47, 0.85)" }}
        >
          {profile !== undefined ? profile.username : "Player"}
        </span>
        <span
          className="text-[11px]"
          style={{ color: "rgba(55, 53, 47, 0.45)" }}
        >
          {profile !== undefined ? "Connected" : "Not signed in"}
        </span>
      </div>
    </Link>
  );
}

export function Sidebar(): ReactNode {
  return (
    <aside
      className="flex w-[240px] shrink-0 flex-col bg-[rgba(247,246,243,1)]"
      style={{ borderRight: "1px solid rgba(55, 53, 47, 0.09)" }}
    >
      {/* Main navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
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
      <div
        className="flex flex-col gap-0.5 px-2 py-3"
        style={{ borderTop: "1px solid rgba(55, 53, 47, 0.09)" }}
      >
        <NavItem to="/settings" icon={Settings} label="Settings" />
        <PlayerBadge />
      </div>
    </aside>
  );
}
