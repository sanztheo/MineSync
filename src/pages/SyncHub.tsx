import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RefreshCw, Users, Share2, ArrowDownToLine } from "lucide-react";

export function SyncHub(): ReactNode {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Sync Hub</h1>
        <p className="text-sm text-zinc-500">
          Synchronize mods with friends via P2P
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Create session */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-900/30">
                <Share2 size={16} className="text-emerald-400" />
              </div>
              <h3 className="font-medium text-zinc-200">Create Session</h3>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500">
              Share your mod setup with friends by creating a sync session.
              They&apos;ll get a code to join.
            </p>
            <Button size="sm" icon={<RefreshCw size={14} />} disabled>
              Create Session
            </Button>
          </CardContent>
        </Card>

        {/* Join session */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900/30">
                <Users size={16} className="text-blue-400" />
              </div>
              <h3 className="font-medium text-zinc-200">Join Session</h3>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500">
              Enter a sync code from a friend to download their mod setup.
            </p>
            <div className="flex items-end gap-2">
              <Input
                placeholder="Enter sync code..."
                className="flex-1"
                disabled
              />
              <Button
                size="sm"
                variant="secondary"
                icon={<ArrowDownToLine size={14} />}
                disabled
              >
                Join
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active sessions (placeholder) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          Active Sessions
        </h2>
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border-default py-12 text-zinc-600">
          <p className="text-sm">No active sync sessions</p>
        </div>
      </div>
    </div>
  );
}
