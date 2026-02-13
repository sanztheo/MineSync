import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Plus, Play, RefreshCw } from "lucide-react";
import type { ModLoader } from "@/lib/types";

interface MockInstance {
  id: string;
  name: string;
  version: string;
  loader: ModLoader;
  modCount: number;
}

const MOCK_INSTANCES: readonly MockInstance[] = [
  {
    id: "1",
    name: "Survival SMP",
    version: "1.21.5",
    loader: "fabric",
    modCount: 42,
  },
  {
    id: "2",
    name: "Creative Build",
    version: "1.20.4",
    loader: "forge",
    modCount: 18,
  },
  {
    id: "3",
    name: "Vanilla Friends",
    version: "1.21.5",
    loader: "vanilla",
    modCount: 0,
  },
];

const LOADER_BADGE_VARIANT: Record<
  ModLoader,
  "success" | "info" | "warning" | "default" | "danger"
> = {
  fabric: "info",
  forge: "warning",
  neoforge: "danger",
  quilt: "success",
  vanilla: "default",
};

function InstanceCard({ instance }: { instance: MockInstance }): ReactNode {
  return (
    <Link to={`/instance/${instance.id}`} className="block">
      <Card hoverable className="flex flex-col gap-3">
        {/* Instance icon placeholder */}
        <div className="flex h-24 items-center justify-center rounded-lg bg-surface-600">
          <span className="text-3xl">🟩</span>
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-zinc-100">{instance.name}</h3>
          <div className="flex items-center gap-2">
            <Badge variant={LOADER_BADGE_VARIANT[instance.loader]}>
              {instance.loader}
            </Badge>
            <span className="text-xs text-zinc-500">{instance.version}</span>
            {instance.modCount > 0 && (
              <span className="text-xs text-zinc-600">
                {instance.modCount} mods
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            icon={<Play size={12} />}
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            Play
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw size={12} />}
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            Sync
          </Button>
        </div>
      </Card>
    </Link>
  );
}

export function Home(): ReactNode {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">My Instances</h1>
          <p className="text-sm text-zinc-500">
            Manage your Minecraft instances
          </p>
        </div>
        <Button icon={<Plus size={16} />}>New Instance</Button>
      </div>

      {/* Instance grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_INSTANCES.map((instance) => (
          <InstanceCard key={instance.id} instance={instance} />
        ))}

        {/* New instance placeholder card */}
        <button
          type="button"
          className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border-hover bg-transparent text-zinc-600 transition-colors hover:border-accent hover:text-accent"
        >
          <div className="flex flex-col items-center gap-2">
            <Plus size={24} />
            <span className="text-sm font-medium">Add Instance</span>
          </div>
        </button>
      </div>
    </div>
  );
}
