import { type ReactNode, useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  Gamepad2,
  Package,
  Boxes,
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
  { to: "/", icon: Gamepad2, label: "Home" },
  { to: "/mods", icon: Package, label: "Browse Mods" },
  { to: "/modpacks", icon: Boxes, label: "Modpacks" },
  { to: "/sync", icon: RefreshCw, label: "Sync Hub" },
] as const;

function NavItem({ to, icon: Icon, label }: NavItemProps): ReactNode {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-emerald-50 text-emerald-700 shadow-sm"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        }`
      }
    >
      <Icon size={18} />
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

    // Re-check profile periodically (picks up login/logout from Auth page)
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      to="/auth"
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 hover:bg-gray-100"
    >
      {profile !== undefined ? (
        <img
          src={`${SKIN_BASE_URL}/${profile.uuid}/32`}
          alt={profile.username}
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg shadow-button"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
          <User size={16} className="text-gray-400" />
        </div>
      )}
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-gray-700">
          {profile !== undefined ? profile.username : "Player"}
        </span>
        <span className="text-[10px] font-medium text-gray-400">
          {profile !== undefined ? "Connected" : "Not signed in"}
        </span>
      </div>
    </Link>
  );
}

export function Sidebar(): ReactNode {
  return (
    <aside className="flex w-[230px] shrink-0 flex-col bg-white shadow-soft">
      {/* Main navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-4">
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
      <div className="flex flex-col gap-1 border-t border-gray-100 p-4">
        <NavItem to="/settings" icon={Settings} label="Settings" />
        <PlayerBadge />
      </div>
    </aside>
  );
}
