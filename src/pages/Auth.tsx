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
    <Card className="bg-white shadow-soft rounded-[20px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
            <LogIn size={18} className="text-emerald-600" />
          </div>
          <h3 className="font-medium text-gray-900">Enter this code</h3>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-4">
        {/* Code display */}
        <button
          onClick={copyCode}
          className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-6 py-3 transition-colors hover:border-emerald-300"
        >
          <span className="font-mono text-2xl font-bold tracking-[0.3em] text-gray-900">
            {info.user_code}
          </span>
          {copied ? (
            <Check size={18} className="text-emerald-600" />
          ) : (
            <Copy
              size={18}
              className="text-gray-500 group-hover:text-emerald-600"
            />
          )}
        </button>
        <p className="text-xs text-gray-500">Click to copy</p>

        {/* Link to verification */}
        <button
          type="button"
          onClick={() => openUrl(info.verification_uri)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          Open {info.verification_uri} <ExternalLink size={14} />
        </button>

        <div className="flex items-center gap-2 pt-2">
          <Loader2 size={14} className="animate-spin text-emerald-600" />
          <span className="text-xs text-gray-500">
            Waiting for you to sign in on Microsoft\u2026
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
    <Card className="bg-white shadow-soft rounded-[20px]">
      <CardContent className="flex items-center gap-4">
        <img
          src={`${SKIN_BASE_URL}/${profile.uuid}/64`}
          alt={`${profile.username} skin`}
          className="h-16 w-16 rounded-lg shadow-button"
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
    <div className="flex flex-1 flex-col gap-6 bg-surface-100 p-7">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Account</h1>
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
        <Card className="bg-white shadow-soft rounded-[20px]">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-50">
              <User size={32} className="text-emerald-600" />
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
        <Card className="bg-white shadow-soft rounded-[20px]">
          <CardContent className="flex items-center justify-center gap-3 py-8">
            <Loader2 size={20} className="animate-spin text-emerald-600" />
            <span className="text-sm text-gray-500">
              Starting authentication\u2026
            </span>
          </CardContent>
        </Card>
      )}

      {/* Device code flow active */}
      {phase.step === "device_code" && <DeviceCodeDisplay info={phase.info} />}

      {/* Error */}
      {phase.step === "error" && (
        <Card className="bg-white shadow-soft rounded-[20px] border-red-200">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
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
      <Card className="bg-white shadow-soft rounded-[20px]">
        <CardHeader>
          <h3 className="text-sm font-medium text-gray-500">How it works</h3>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-medium text-emerald-600">
                1
              </span>
              <span>Click &quot;Sign in with Microsoft&quot;</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-medium text-emerald-600">
                2
              </span>
              <span>Copy the code and enter it on the Microsoft page</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-medium text-emerald-600">
                3
              </span>
              <span>Sign in with your Microsoft/Xbox account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-medium text-emerald-600">
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
