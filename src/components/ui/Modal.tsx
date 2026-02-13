import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";

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
      className="fixed inset-0 z-50 m-auto max-w-lg rounded-xl border border-border-default bg-surface-800 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/70"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-surface-600 hover:text-zinc-300"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5">{children}</div>

      {/* Footer */}
      {footer !== undefined && (
        <div className="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
