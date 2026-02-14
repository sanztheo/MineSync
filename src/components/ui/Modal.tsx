import { type ReactNode, useEffect, useRef } from "react";
import { X } from "@/components/ui/PixelIcon";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: ModalProps): ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  if (!open) return undefined;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto max-w-lg border-0 bg-[var(--color-notion-bg)] p-0 backdrop:bg-black/25 backdrop:backdrop-blur-[2px]"
      style={{
        borderRadius: "12px",
        color: "var(--color-notion-text)",
        boxShadow: "var(--shadow-md-theme)",
        overscrollBehavior: "contain",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--color-notion-border-light)" }}
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="rounded-md p-1.5 transition-colors duration-150 hover:bg-[var(--color-notion-bg-hover)]"
          style={{ color: "var(--color-notion-text-tertiary)" }}
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-5 py-4">{children}</div>

      {footer !== undefined && (
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: "1px solid var(--color-notion-border-light)" }}
        >
          {footer}
        </div>
      )}
    </dialog>
  );
}
