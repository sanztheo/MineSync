import type { ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  Package,
  FolderOpen,
  Trash2,
} from "lucide-react";

export function InstanceDetail(): ReactNode {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Back + title */}
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-surface-600 hover:text-zinc-300"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-100">Instance {id}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="info">fabric</Badge>
            <span className="text-sm text-zinc-500">1.21.5</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<Play size={14} />}>Launch</Button>
          <Button variant="secondary" icon={<RefreshCw size={14} />}>
            Sync
          </Button>
        </div>
      </div>

      {/* Sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package size={16} className="text-zinc-400" />
              <h3 className="font-medium text-zinc-200">Installed Mods</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              Mod list will appear here once the instance is configured.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-zinc-400" />
              <h3 className="font-medium text-zinc-200">Instance Files</h3>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500">
              Open the instance directory in your file manager.
            </p>
            <Button
              size="sm"
              variant="secondary"
              icon={<FolderOpen size={14} />}
            >
              Open Folder
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Danger zone */}
      <Card className="border-red-900/30">
        <CardHeader>
          <h3 className="font-medium text-red-400">Danger Zone</h3>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Permanently delete this instance and all its data.
          </p>
          <Button size="sm" variant="danger" icon={<Trash2 size={14} />}>
            Delete
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
