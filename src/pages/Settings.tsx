import { type ReactNode, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Slider } from "@/components/ui/Slider";
import {
  FolderOpen,
  HardDrive,
  Cpu,
  Wifi,
  Info,
  ExternalLink,
  Loader2,
  Download,
} from "@/components/ui/PixelIcon";
import { useJavaRuntime } from "@/hooks/use-java-runtime";

const MIN_RAM_MB = 1024;
const MAX_RAM_MB = 16384;
const RAM_STEP_MB = 512;
const DEFAULT_RAM_MB = 4096;

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
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-medium text-gray-900">{title}</h3>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

export function Settings(): ReactNode {
  const [ramMb, setRamMb] = useState(DEFAULT_RAM_MB);
  const [p2pEnabled, setP2pEnabled] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const { status: javaStatus, installJava, isInstalling } = useJavaRuntime();

  return (
    <div className="flex flex-1 flex-col gap-6 p-7">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600">Configure MineSync</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Installation directory */}
        <SettingsSection
          icon={
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{ background: "rgba(35,131,226,0.1)" }}
            >
              <FolderOpen size={18} className="text-[#2383E2]" />
            </div>
          }
          title="Game Directory"
        >
          <Input
            label="Minecraft instances directory"
            placeholder="~/.minesync/instances"
            disabled
          />
          <div>
            <Button
              size="sm"
              variant="secondary"
              icon={<FolderOpen size={14} />}
            >
              Browse
            </Button>
          </div>
        </SettingsSection>

        {/* Java Runtime */}
        <SettingsSection
          icon={
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{ background: "rgba(251,243,219,1)" }}
            >
              <HardDrive size={18} className="text-[#DFAB01]" />
            </div>
          }
          title="Java Runtime"
        >
          <Input
            label="Java path"
            value={javaStatus.status === "ready" ? javaStatus.java_path : ""}
            placeholder="Not installed"
            disabled
          />
          <p className="text-xs text-gray-600">
            {javaStatus.status === "ready"
              ? `Java ${String(javaStatus.major_version)} (${javaStatus.source})`
              : "Java 21 requis pour lancer les instances."}
          </p>
          <div>
            <Button
              size="sm"
              variant="secondary"
              icon={
                isInstalling ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )
              }
              disabled={isInstalling}
              onClick={() => {
                void installJava({ nonBlockingIfReady: true });
              }}
            >
              {isInstalling ? "Installing…" : "Install / Reinstall Java 21"}
            </Button>
          </div>
        </SettingsSection>

        {/* Memory / RAM */}
        <SettingsSection
          icon={
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{ background: "rgba(221,237,234,1)" }}
            >
              <Cpu size={18} className="text-[#0F7B6C]" />
            </div>
          }
          title="Memory Allocation"
        >
          <Slider
            label="Maximum RAM"
            value={ramMb}
            min={MIN_RAM_MB}
            max={MAX_RAM_MB}
            step={RAM_STEP_MB}
            unit=" MB"
            onChange={setRamMb}
          />
          <p className="text-xs text-gray-600">
            Recommended: 4096 MB for modded, 2048 MB for vanilla.
          </p>
        </SettingsSection>

        {/* Network / P2P */}
        <SettingsSection
          icon={
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{ background: "rgba(232,222,238,1)" }}
            >
              <Wifi size={18} className="text-[#9065B0]" />
            </div>
          }
          title="Network"
        >
          <Toggle
            checked={p2pEnabled}
            onChange={setP2pEnabled}
            label="P2P Sync"
            description="Enable peer-to-peer mod synchronization"
          />
          <Toggle
            checked={autoUpdate}
            onChange={setAutoUpdate}
            label="Auto-update mods"
            description="Automatically check for mod updates on launch"
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection
          icon={
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100">
              <Info size={18} className="text-gray-600" />
            </div>
          }
          title="About"
        >
          <div className="flex flex-col gap-2 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>MineSync</span>
              <span className="font-mono text-xs text-gray-500">v0.1.0</span>
            </div>
            <p>Minecraft Launcher with P2P Mod Sync</p>
            <div className="flex gap-3 pt-1">
              <a
                href="https://github.com/minesync"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#2383E2] transition-colors hover:underline"
              >
                GitHub <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
