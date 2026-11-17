"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  hideCancelButton?: boolean;
  confirmButtonClassName?: string;
  confirmDisabled?: boolean;
  pending?: boolean;
  closeOnEsc?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  hideCancelButton = false,
  confirmButtonClassName = "btn-primary",
  confirmDisabled = false,
  pending = false,
  closeOnEsc = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open || !closeOnEsc || pending) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" ||
        event.key === "Esc" ||
        event.code === "Escape"
      ) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeOnEsc, pending, onCancel]);

  useEffect(() => {
    if (!open || pending) {
      return;
    }

    const buttonToFocus = hideCancelButton
      ? confirmButtonRef.current
      : cancelButtonRef.current;
    if (buttonToFocus) {
      buttonToFocus.focus();
    }
  }, [open, pending, hideCancelButton]);

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close confirmation dialog"
        className="app-drawer-backdrop !z-[90]"
        onClick={onCancel}
      />
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={pending ? undefined : onCancel}
      >
        <section
          dir="ltr"
          className="flex max-h-[calc(100vh-3rem)] w-full max-w-xl flex-col rounded-3xl border border-[color:var(--border)] bg-white p-6 text-left shadow-xl"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <p className="section-label">Warning</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <div className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
              {message}
            </div>
            {children ? <div className="mt-4">{children}</div> : null}
          </div>

          <div className="mt-6 flex shrink-0 flex-wrap justify-start gap-3">
            {!hideCancelButton ? (
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={onCancel}
                disabled={pending}
                className="btn-secondary"
              >
                {cancelLabel}
              </button>
            ) : null}
            <button
              ref={hideCancelButton ? confirmButtonRef : undefined}
              type="button"
              onClick={onConfirm}
              disabled={pending || confirmDisabled}
              className={confirmButtonClassName}
            >
              {confirmLabel}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
