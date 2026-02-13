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
      className="fixed inset-0 z-50 m-auto max-w-lg border-0 bg-white p-0 backdrop:bg-black/20 backdrop:backdrop-blur-[2px]"
      style={{
        borderRadius: "12px",
        color: "rgba(55, 53, 47, 1)",
        boxShadow:
          "rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 5px 10px, rgba(15, 15, 15, 0.2) 0px 15px 40px",
        overscrollBehavior: "contain",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid rgba(55, 53, 47, 0.09)" }}
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="rounded-md p-1.5 transition-colors duration-150 hover:bg-[rgba(55,53,47,0.06)]"
          style={{ color: "rgba(55, 53, 47, 0.45)" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="px-5 py-4">{children}</div>

      {/* Footer */}
      {footer !== undefined && (
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: "1px solid rgba(55, 53, 47, 0.09)" }}
        >
          {footer}
        </div>
      )}
    </dialog>
  );
}
