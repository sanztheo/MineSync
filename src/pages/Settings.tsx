import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FolderOpen, HardDrive, Palette, Info } from "lucide-react";

function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-medium text-zinc-200">{title}</h3>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

export function Settings(): ReactNode {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500">Configure MineSync</p>
      </div>

      <div className="flex flex-col gap-4">
        <SettingsSection
          icon={<FolderOpen size={18} className="text-zinc-400" />}
          title="Game Directory"
        >
          <Input
            label="Minecraft instances directory"
            placeholder="~/.minesync/instances"
            disabled
          />
          <Button size="sm" variant="secondary" icon={<FolderOpen size={14} />}>
            Browse
          </Button>
        </SettingsSection>

        <SettingsSection
          icon={<HardDrive size={18} className="text-zinc-400" />}
          title="Java Runtime"
        >
          <p className="text-sm text-zinc-500">
            Java runtime will be auto-detected or can be set manually.
          </p>
          <Input label="Java path" placeholder="Auto-detect" disabled />
        </SettingsSection>

        <SettingsSection
          icon={<Palette size={18} className="text-zinc-400" />}
          title="Appearance"
        >
          <p className="text-sm text-zinc-500">
            Theme customization coming soon.
          </p>
        </SettingsSection>

        <SettingsSection
          icon={<Info size={18} className="text-zinc-400" />}
          title="About"
        >
          <div className="flex flex-col gap-1 text-sm text-zinc-500">
            <p>MineSync v0.1.0</p>
            <p>Minecraft Launcher with P2P Mod Sync</p>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
