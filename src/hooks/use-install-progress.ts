import { useState, useEffect, useRef } from "react";
import { getInstallProgress } from "@/lib/tauri";
import type { InstallProgress } from "@/lib/types";

const POLL_INTERVAL_MS = 1000;

function isActiveStage(progress: InstallProgress): boolean {
  const { type } = progress.stage;
  return type !== "completed" && type !== "failed";
}

interface UseInstallProgressResult {
  progress: InstallProgress | undefined;
  isInstalling: boolean;
  installingInstanceId: string | undefined;
}

export function useInstallProgress(): UseInstallProgressResult {
  const [progress, setProgress] = useState<InstallProgress | undefined>(
    undefined,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  useEffect(() => {
    const poll = (): void => {
      getInstallProgress()
        .then((p) => {
          if (isActiveStage(p)) {
            setProgress(p);
          } else {
            setProgress(undefined);
          }
        })
        .catch(() => {
          // Ignore polling errors
        });
    };

    // Initial poll
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    progress,
    isInstalling: progress !== undefined,
    installingInstanceId: progress?.instance_id,
  };
}
