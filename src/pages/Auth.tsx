import {
  type ReactNode,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  LogIn,
  LogOut,
  Copy,
  Check,
  ExternalLink,
  User,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { startAuth, pollAuth, getProfile, logout } from "@/lib/tauri";
import type {
  DeviceCodeInfo,
  MinecraftProfile,
  AuthPollResult,
} from "@/lib/types";

type AuthPhase =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "device_code"; info: DeviceCodeInfo }
  | { step: "polling" }
  | { step: "error"; message: string };

const POLL_INTERVAL_MS = 3000;
const SKIN_BASE_URL = "https://mc-heads.net/avatar";

function DeviceCodeDisplay({ info }: { info: DeviceCodeInfo }): ReactNode {
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(info.user_code);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard API may not be available in Tauri webview without focus
    }
  }, [info.user_code]);

  return (
    <Card className="rounded-lg bg-white">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-md"
            style={{ background: "rgba(55,53,47,0.08)" }}
          >
            <LogIn size={18} style={{ color: "rgba(55, 53, 47, 0.65)" }} />
          </div>
          <h3 className="font-medium text-gray-900">Enter this code</h3>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-4">
        {/* Code display */}
        <button
          onClick={copyCode}
          className="group flex items-center gap-3 rounded-md border border-gray-200 bg-[rgba(55,53,47,0.04)] px-6 py-3 transition-colors hover:border-[rgba(55,53,47,0.24)]"
        >
          <span className="font-mono text-2xl font-bold tracking-[0.3em] text-gray-900">
            {info.user_code}
          </span>
          {copied ? (
            <Check size={18} style={{ color: "rgba(55, 53, 47, 0.65)" }} />
          ) : (
            <Copy
              size={18}
              className="text-gray-500 group-hover:text-[rgba(55,53,47,0.65)]"
            />
          )}
        </button>
        <p className="text-xs text-gray-500">Click to copy</p>

        {/* Link to verification */}
        <button
          type="button"
          onClick={() => openUrl(info.verification_uri)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-[rgba(55,53,47,0.04)] px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          Open {info.verification_uri} <ExternalLink size={14} />
        </button>

        <div className="flex items-center gap-2 pt-2">
          <Loader2
            size={14}
            className="animate-spin"
            style={{ color: "rgba(55, 53, 47, 0.45)" }}
          />
          <span className="text-xs text-gray-500">
            Waiting for you to sign in on Microsoft…
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerProfile({
  profile,
  onLogout,
}: {
  profile: MinecraftProfile;
  onLogout: () => void;
}): ReactNode {
  return (
    <Card className="rounded-lg bg-white">
      <CardContent className="flex items-center gap-4">
        <img
          src={`${SKIN_BASE_URL}/${profile.uuid}/64`}
          alt={`${profile.username} skin`}
          className="h-16 w-16 rounded-lg"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-lg font-bold text-gray-900">
            {profile.username}
          </span>
          <span className="font-mono text-xs text-gray-600">
            {profile.uuid}
          </span>
          <Badge variant="success">Connected</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<LogOut size={14} />}
          onClick={onLogout}
        >
          Sign out
        </Button>
      </CardContent>
    </Card>
  );
}

export function Auth(): ReactNode {
  const [phase, setPhase] = useState<AuthPhase>({ step: "idle" });
  const [profile, setProfile] = useState<MinecraftProfile | undefined>(
    undefined,
  );
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  const stopPolling = useCallback((): void => {
    if (pollTimerRef.current !== undefined) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = undefined;
    }
  }, []);

  // Load profile on mount
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const p = await getProfile();
        if (p !== undefined) {
          setProfile(p);
        }
      } catch {
        // No profile yet — that's fine
      }
    };
    load();
    return stopPolling;
  }, [stopPolling]);

  const handleStartAuth = useCallback(async (): Promise<void> => {
    setPhase({ step: "loading" });
    try {
      const info = await startAuth();
      setPhase({ step: "device_code", info });

      // Start polling
      pollTimerRef.current = setInterval(async () => {
        try {
          const result: AuthPollResult = await pollAuth();
          switch (result.status) {
            case "pending":
              break;
            case "success":
              stopPolling();
              setProfile({ username: result.username, uuid: result.uuid });
              setPhase({ step: "idle" });
              break;
            case "expired":
              stopPolling();
              setPhase({
                step: "error",
                message: "Code expired. Please try again.",
              });
              break;
            case "error":
              stopPolling();
              setPhase({ step: "error", message: result.message });
              break;
          }
        } catch {
          stopPolling();
          setPhase({
            step: "error",
            message: "Connection lost while polling.",
          });
        }
      }, POLL_INTERVAL_MS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setPhase({ step: "error", message });
    }
  }, [stopPolling]);

  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      await logout();
      setProfile(undefined);
      setPhase({ step: "idle" });
    } catch {
      // Ignore logout failures
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6 p-7">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>
        <p className="text-sm text-gray-600">
          Sign in with your Microsoft account to play Minecraft
        </p>
      </div>

      {/* Connected profile */}
      {profile !== undefined && (
        <PlayerProfile profile={profile} onLogout={handleLogout} />
      )}

      {/* Not connected — sign in */}
      {profile === undefined && phase.step === "idle" && (
        <Card className="rounded-lg bg-white">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-md"
              style={{ background: "rgba(55,53,47,0.08)" }}
            >
              <User size={32} style={{ color: "rgba(55, 53, 47, 0.65)" }} />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-gray-900">Not signed in</h3>
              <p className="text-sm text-gray-600">
                Sign in with Microsoft to access multiplayer and sync
              </p>
            </div>
            <Button icon={<LogIn size={16} />} onClick={handleStartAuth}>
              Sign in with Microsoft
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {phase.step === "loading" && (
        <Card className="rounded-lg bg-white">
          <CardContent className="flex items-center justify-center gap-3 py-8">
            <Loader2
              size={20}
              className="animate-spin"
              style={{ color: "rgba(55, 53, 47, 0.45)" }}
            />
            <span className="text-sm text-gray-500">
              Starting authentication…
            </span>
          </CardContent>
        </Card>
      )}

      {/* Device code flow active */}
      {phase.step === "device_code" && <DeviceCodeDisplay info={phase.info} />}

      {/* Error */}
      {phase.step === "error" && (
        <Card
          className="rounded-lg bg-white"
          style={{ border: "1px solid rgba(239, 68, 68, 0.5)" }}
        >
          <CardContent className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-50">
              <AlertCircle size={18} className="text-red-600" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-red-600">
                Authentication failed
              </span>
              <span className="text-xs text-gray-500">{phase.message}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={handleStartAuth}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="rounded-lg bg-white">
        <CardHeader>
          <h3 className="text-sm font-medium text-gray-500">How it works</h3>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                style={{
                  background: "rgba(55,53,47,0.08)",
                  color: "rgba(55, 53, 47, 0.65)",
                }}
              >
                1
              </span>
              <span>Click &quot;Sign in with Microsoft&quot;</span>
            </li>
            <li className="flex items-start gap-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                style={{
                  background: "rgba(55,53,47,0.08)",
                  color: "rgba(55, 53, 47, 0.65)",
                }}
              >
                2
              </span>
              <span>Copy the code and enter it on the Microsoft page</span>
            </li>
            <li className="flex items-start gap-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                style={{
                  background: "rgba(55,53,47,0.08)",
                  color: "rgba(55, 53, 47, 0.65)",
                }}
              >
                3
              </span>
              <span>Sign in with your Microsoft/Xbox account</span>
            </li>
            <li className="flex items-start gap-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                style={{
                  background: "rgba(55,53,47,0.08)",
                  color: "rgba(55, 53, 47, 0.65)",
                }}
              >
                4
              </span>
              <span>
                MineSync will automatically detect when you&apos;re done
              </span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
