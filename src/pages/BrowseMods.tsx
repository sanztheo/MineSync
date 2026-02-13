import type { ReactNode } from "react";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Search, Download, Package } from "lucide-react";

interface MockMod {
  id: string;
  name: string;
  author: string;
  downloads: string;
  source: "curseforge" | "modrinth";
}

const MOCK_MODS: readonly MockMod[] = [
  {
    id: "1",
    name: "Sodium",
    author: "CaffeineMC",
    downloads: "45M",
    source: "modrinth",
  },
  {
    id: "2",
    name: "Create",
    author: "simibubi",
    downloads: "38M",
    source: "curseforge",
  },
  {
    id: "3",
    name: "JEI",
    author: "mezz",
    downloads: "220M",
    source: "curseforge",
  },
];

function ModCard({ mod }: { mod: MockMod }): ReactNode {
  return (
    <Card hoverable className="flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-600">
        <Package size={20} className="text-zinc-500" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-zinc-100">{mod.name}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">by {mod.author}</span>
          <Badge variant={mod.source === "modrinth" ? "success" : "warning"}>
            {mod.source}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-600">{mod.downloads}</span>
        <Button size="sm" variant="secondary" icon={<Download size={12} />}>
          Install
        </Button>
      </div>
    </Card>
  );
}

export function BrowseMods(): ReactNode {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Browse Mods</h1>
        <p className="text-sm text-zinc-500">Search CurseForge and Modrinth</p>
      </div>

      <Input placeholder="Search mods..." icon={<Search size={16} />} />

      <div className="flex flex-col gap-3">
        {MOCK_MODS.map((mod) => (
          <ModCard key={mod.id} mod={mod} />
        ))}
      </div>
    </div>
  );
}
