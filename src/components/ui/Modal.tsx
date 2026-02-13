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
      className="fixed inset-0 z-50 m-auto max-w-lg rounded-[24px] border-0 bg-white p-0 text-gray-900 shadow-float backdrop:bg-black/30 backdrop:backdrop-blur-sm"
      style={{ overscrollBehavior: "contain" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5">{children}</div>

      {/* Footer */}
      {footer !== undefined && (
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
