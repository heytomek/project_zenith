"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  Building2,
  Orbit,
  Network,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Profile } from "@/lib/coordination/types";

export const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);
export const metric = (value: number, unit: string) =>
  `${number(value)} ${unit}`;
export function WorldIcon({
  kind,
  size = 20,
}: {
  kind: Profile["icon"];
  size?: number;
}) {
  const Icon = {
    region: Network,
    enterprise: Building2,
    commons: Orbit,
    custom: Sparkles,
  }[kind];
  return <Icon size={size} aria-hidden="true" />;
}
export function Mark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 23 14 5l10 18M8 17h12M11 22h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onClick,
  className = "",
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = ref.current!;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea,select,[tabindex="0"]',
        ),
      ).filter((node) => node.getClientRects().length);
    (focusable()[0] ?? dialog).focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key === "Tab") {
        const nodes = focusable();
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="z-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="z-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
      >
        <div className="dialog-head">
          <h2 id="dialog-title">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}
export function download(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
