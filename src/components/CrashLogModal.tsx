import {
  type ReactNode,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Cpu,
} from "@/components/ui/PixelIcon";
import type { CrashLog } from "@/lib/types";

// --- AI Crash Analysis ---

interface AnalysisSection {
  title: string;
  content: string;
}

function parseAnalysis(raw: string): AnalysisSection[] {
  const sections: AnalysisSection[] = [];
  const lines = raw.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = /^#{1,3}\s+(.+)$/.exec(line);
    if (headerMatch !== null) {
      if (currentTitle !== "" || currentContent.length > 0) {
        sections.push({
          title: currentTitle,
          content: currentContent.join("\n").trim(),
        });
      }
      currentTitle = headerMatch[1].replace(/\*+/g, "").trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle !== "" || currentContent.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentContent.join("\n").trim(),
    });
  }

  return sections.length > 0 ? sections : [{ title: "Analyse", content: raw }];
}

function analyzeCrashLog(crashLog: CrashLog): string {
  const stderr = crashLog.stderr.trim();
  const stdout = crashLog.stdout.trim();
  const log = stderr.length > 0 ? stderr : stdout;
  const lower = log.toLowerCase();
  const exitCode = crashLog.exit_code;

  const lines: string[] = [];

  // Out of memory
  if (
    lower.includes("outofmemoryerror") ||
    lower.includes("out of memory") ||
    lower.includes("gc overhead limit")
  ) {
    lines.push("## Cause probable");
    lines.push("Le jeu a manque de memoire RAM (OutOfMemoryError).");
    lines.push("");
    lines.push("## Solution");
    lines.push(
      "Augmente la memoire allouee dans les parametres (Settings > RAM). Essaie avec 4 Go minimum, ou 6-8 Go si tu as beaucoup de mods.",
    );
    return lines.join("\n");
  }

  // OpenGL / GPU driver crash
  if (
    lower.includes("opengl") ||
    lower.includes("glfw") ||
    lower.includes("lwjgl") ||
    lower.includes("display mode") ||
    lower.includes("pixel format")
  ) {
    lines.push("## Cause probable");
    lines.push(
      "Erreur graphique (OpenGL / LWJGL). Les drivers GPU ne sont pas compatibles ou sont obsoletes.",
    );
    lines.push("");
    lines.push("## Solution");
    lines.push(
      "1. Mets a jour tes drivers graphiques (NVIDIA/AMD/Intel)\n2. Si tu es sur macOS, assure-toi que -XstartOnFirstThread est bien passe\n3. Essaie de desactiver les shaders/OptiFine si installes",
    );
    return lines.join("\n");
  }

  // Mod conflict / ClassNotFoundException
  if (
    lower.includes("classnotfoundexception") ||
    lower.includes("nosuchmethod") ||
    lower.includes("nosuchfield") ||
    lower.includes("incompatibleclasschangeerror")
  ) {
    const classMatch =
      /(?:ClassNotFoundException|NoSuchMethodError|NoSuchFieldError):\s*([^\n]+)/i.exec(
        log,
      );
    lines.push("## Cause probable");
    const detail = classMatch !== null ? ` : ${classMatch[1].trim()}` : "";
    lines.push(
      `Conflit ou incompatibilite de mods. Une classe Java est introuvable${detail}.`,
    );
    lines.push("");
    lines.push("## Solution");
    lines.push(
      "1. Verifie que tous tes mods sont compatibles avec la meme version de Minecraft\n2. Verifie que le mod loader (Fabric/Forge) est a la bonne version\n3. Essaie de retirer les mods un par un pour identifier le conflit",
    );
    return lines.join("\n");
  }

  // Mixin injection failure (common with Fabric mods)
  if (
    lower.includes("mixin") &&
    (lower.includes("apply") ||
      lower.includes("inject") ||
      lower.includes("failed"))
  ) {
    lines.push("## Cause probable");
    lines.push(
      "Echec d'injection Mixin. Un mod tente de modifier du code incompatible avec ta version de Minecraft.",
    );
    lines.push("");
    lines.push("## Solution");
    lines.push(
      "1. Mets a jour tous tes mods vers leur derniere version\n2. Verifie la compatibilite des versions Minecraft\n3. Le mod responsable est souvent mentionne dans l'erreur ci-dessus",
    );
    return lines.join("\n");
  }

  // Missing mod dependency
  if (
    (lower.includes("missing") && lower.includes("dependency")) ||
    (lower.includes("requires") && lower.includes("mod")) ||
    lower.includes("fabric requires")
  ) {
    lines.push("## Cause probable");
    lines.push("Un mod necessite une dependance manquante.");
    lines.push("");
    lines.push("## Solution");
    lines.push(
      "Installe les mods dependants requis. Regarde le message d'erreur ci-dessus pour identifier quelles dependances sont manquantes (souvent Fabric API, Architectury, Cloth Config, etc.).",
    );
    return lines.join("\n");
  }

  // Java version mismatch
  if (
    lower.includes("unsupportedclassversion") ||
    lower.includes("class file version") ||
    lower.includes("has been compiled by a more recent")
  ) {
    lines.push("## Cause probable");
    lines.push(
      "Version de Java incompatible. Le jeu ou un mod necessite une version de Java plus recente.",
    );
    lines.push("");
    lines.push("## Solution");
    lines.push(
      "MineSync installe automatiquement Java 21. Si le probleme persiste, verifie que le bon Java est selectionne dans Settings.",
    );
    return lines.join("\n");
  }

  // StackOverflow
  if (lower.includes("stackoverflowerror")) {
    lines.push("## Cause probable");
    lines.push(
      "Debordement de pile (StackOverflowError), souvent cause par une boucle infinie dans un mod.",
    );
    lines.push("");
    lines.push("## Solution");
    lines.push(
      "1. Retire le dernier mod ajoute\n2. Augmente la taille de la pile Java (-Xss) dans les parametres avances",
    );
    return lines.join("\n");
  }

  // Generic crash with exit code
  if (exitCode !== null) {
    lines.push("## Cause probable");
    if (exitCode === 1) {
      lines.push(
        "Erreur generique Java (exit code 1). Regarde les logs stderr ci-dessus pour plus de details.",
      );
    } else if (exitCode === 255 || exitCode === -1) {
      lines.push(
        "Le process s'est termine de facon anormale (exit code 255). Cela peut indiquer un crash natif, un probleme de memoire ou un conflit de mods.",
      );
    } else if (exitCode === 137) {
      lines.push(
        "Le process a ete tue par le systeme (OOM Killer). La memoire allouee est insuffisante.",
      );
    } else {
      lines.push(
        "Le jeu s'est arrete avec le code de sortie " + String(exitCode) + ".",
      );
    }
    lines.push("");
    lines.push("## Solution");
    lines.push(
      "1. Verifie les logs ci-dessus pour identifier l'erreur exacte\n2. Essaie de lancer le jeu sans mods pour isoler le probleme\n3. Augmente la RAM allouee si le crash semble lie a la memoire",
    );
    return lines.join("\n");
  }

  // Completely unknown
  lines.push("## Analyse");
  lines.push(
    "Impossible de determiner automatiquement la cause du crash. Consulte les logs ci-dessus pour plus d'informations.",
  );
  lines.push("");
  lines.push("## Conseils generaux");
  lines.push(
    "1. Assure-toi que tes mods sont compatibles avec ta version de Minecraft\n2. Verifie que Java 21 est correctement installe\n3. Essaie de lancer une instance vanilla pour verifier que le jeu fonctionne",
  );
  return lines.join("\n");
}

// --- Log Viewer Sub-Component ---

function LogViewer({
  content,
  label,
}: {
  content: string;
  label: string;
}): ReactNode {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (preRef.current !== null) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [content]);

  const handleCopy = useCallback((): void => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  }, [content]);

  if (content.trim().length === 0) return undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--color-notion-text-tertiary)" }}
        >
          {label}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors duration-150"
          style={{ color: "var(--color-notion-text-tertiary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-notion-bg-hover)";
            e.currentTarget.style.color = "var(--color-notion-text-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--color-notion-text-tertiary)";
          }}
        >
          {copied ? (
            <>
              <Check size={10} />
              Copie
            </>
          ) : (
            <>
              <Copy size={10} />
              Copier
            </>
          )}
        </button>
      </div>
      <pre
        ref={preRef}
        className="max-h-48 overflow-auto p-3 font-mono text-[11px] leading-relaxed"
        style={{
          background: "var(--color-notion-bg-tertiary)",
          color: "var(--color-notion-text-secondary)",
          borderRadius: "8px",
          border: "1px solid var(--color-notion-border-light)",
          scrollbarWidth: "thin",
          scrollbarColor:
            "var(--color-notion-border) var(--color-notion-bg-tertiary)",
        }}
      >
        {content}
      </pre>
    </div>
  );
}

// --- Analysis Section Component ---

function AnalysisView({ crashLog }: { crashLog: CrashLog }): ReactNode {
  const [analyzing, setAnalyzing] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisSection[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const raw = analyzeCrashLog(crashLog);
      setAnalysis(parseAnalysis(raw));
      setAnalyzing(false);
    }, 800);

    return () => {
      clearTimeout(timer);
    };
  }, [crashLog]);

  if (analyzing) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg px-4 py-3"
        style={{
          background: "var(--color-accent-purple-bg)",
          border: "1px solid var(--color-notion-border-light)",
        }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--color-notion-bg-hover)" }}
        >
          <Loader2
            size={14}
            className="animate-spin"
            style={{ color: "var(--color-accent-purple)" }}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--color-accent-purple)" }}
          >
            Codex analyse le crash...
          </span>
          <span
            className="text-[10px]"
            style={{ color: "var(--color-notion-text-tertiary)" }}
          >
            Examen des logs et identification du probleme
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4"
      style={{
        background: "var(--color-accent-purple-bg)",
        border: "1px solid var(--color-notion-border-light)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--color-notion-bg-hover)" }}
        >
          <Cpu size={13} style={{ color: "var(--color-accent-purple)" }} />
        </div>
        <span
          className="text-xs font-bold"
          style={{ color: "var(--color-accent-purple)" }}
        >
          Diagnostic Codex
        </span>
      </div>
      {analysis.map((section, idx) => (
        <div key={idx} className="flex flex-col gap-1">
          {section.title !== "" && (
            <span
              className="text-[11px] font-bold"
              style={{ color: "var(--color-notion-text)" }}
            >
              {section.title}
            </span>
          )}
          <p
            className="whitespace-pre-wrap text-[11px] leading-relaxed"
            style={{ color: "var(--color-notion-text-secondary)" }}
          >
            {section.content}
          </p>
        </div>
      ))}
    </div>
  );
}

// --- Main Modal ---

interface CrashLogModalProps {
  open: boolean;
  onClose: () => void;
  crashLog: CrashLog | undefined;
  loading?: boolean;
}

export function CrashLogModal({
  open,
  onClose,
  crashLog,
  loading = false,
}: CrashLogModalProps): ReactNode {
  if (!open || (crashLog === undefined && !loading)) return undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crash Report"
      footer={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fermer
        </Button>
      }
    >
      {loading || crashLog === undefined ? (
        <div className="flex items-center justify-center py-8">
          <Loader2
            size={20}
            className="animate-spin"
            style={{ color: "var(--color-notion-text-tertiary)" }}
          />
          <span
            className="ml-2 text-sm"
            style={{ color: "var(--color-notion-text-secondary)" }}
          >
            Recuperation des logs...
          </span>
        </div>
      ) : (
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          {/* Crash summary header */}
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{
              background: "var(--color-accent-red-bg)",
              border: "1px solid var(--color-notion-border-light)",
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--color-notion-bg-hover)" }}
            >
              <AlertCircle
                size={16}
                style={{ color: "var(--color-accent-red)" }}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-accent-red)" }}
              >
                Le jeu a crashe
                {crashLog.exit_code !== null
                  ? " (code " + String(crashLog.exit_code) + ")"
                  : ""}
              </span>
              <span
                className="text-[10px]"
                style={{ color: "var(--color-notion-text-tertiary)" }}
              >
                {new Date(crashLog.timestamp).toLocaleString("fr-FR")}
              </span>
            </div>
          </div>

          {/* AI Analysis */}
          <AnalysisView crashLog={crashLog} />

          {/* Log output */}
          <LogViewer content={crashLog.stderr} label="stderr (erreurs)" />
          <LogViewer content={crashLog.stdout} label="stdout (sortie)" />
        </div>
      )}
    </Modal>
  );
}
