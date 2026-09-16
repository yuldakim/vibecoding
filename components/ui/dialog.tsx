"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** 네이티브 <dialog>를 감싼 모달. 새 라이브러리 없이 showModal()/close()로 열고 닫는다. */
export function Dialog({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="w-full max-w-sm rounded-lg border border-border p-6 text-lg backdrop:bg-black/40"
    >
      <h2 id={titleId} className="mb-4 text-xl font-bold">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
