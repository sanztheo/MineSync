import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getJavaInstallProgress,
  getJavaStatus,
  installJavaRuntime,
} from "@/lib/tauri";
import type { JavaRuntimeStatus } from "@/lib/types";

const STATUS_POLL_INTERVAL_MS = 1500;

const JavaRuntimeContext = createContext<JavaRuntimeContextValue | undefined>(
  undefined,
);

interface JavaRuntimeContextValue {
  status: JavaRuntimeStatus;
  refreshStatus: () => Promise<void>;
  installJava: () => Promise<void>;
  isReady: boolean;
  isInstalling: boolean;
  isBlocking: boolean;
  errorMessage: string | undefined;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function useProvideJavaRuntime(): JavaRuntimeContextValue {
  const [status, setStatus] = useState<JavaRuntimeStatus>({ status: "missing" });

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const next = await getJavaStatus();
      setStatus(next);
    } catch (err: unknown) {
      setStatus({
        status: "error",
        message: `Impossible de vérifier Java: ${toErrorMessage(err)}`,
      });
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const poll = async (): Promise<void> => {
      try {
        const current = await getJavaInstallProgress();
        setStatus(current);
      } catch {
        // Ignore polling errors
      }
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const installJava = useCallback(async (): Promise<void> => {
    try {
      setStatus({
        status: "installing",
        stage: "preparing",
        percent: 0,
        downloaded_bytes: 0,
        total_bytes: null,
      });
      await installJavaRuntime();
      await refreshStatus();
    } catch (err: unknown) {
      setStatus({ status: "error", message: toErrorMessage(err) });
    }
  }, [refreshStatus]);

  return useMemo(() => {
    const isReady = status.status === "ready";
    const isInstalling = status.status === "installing";
    const isBlocking = !isReady;
    const errorMessage =
      status.status === "error" ? status.message : undefined;

    return {
      status,
      refreshStatus,
      installJava,
      isReady,
      isInstalling,
      isBlocking,
      errorMessage,
    };
  }, [status, refreshStatus, installJava]);
}

export function JavaRuntimeProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const value = useProvideJavaRuntime();
  return (
    <JavaRuntimeContext.Provider value={value}>
      {children}
    </JavaRuntimeContext.Provider>
  );
}

export function useJavaRuntime(): JavaRuntimeContextValue {
  const ctx = useContext(JavaRuntimeContext);
  if (ctx === undefined) {
    throw new Error("useJavaRuntime must be used within JavaRuntimeProvider");
  }
  return ctx;
}
