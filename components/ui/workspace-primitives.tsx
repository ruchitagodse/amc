"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

type PageHeaderProps = {
  label?: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
};

export function PageHeader({
  label,
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  const hasTitle = title.trim().length > 0;
  const hasSubtitle = subtitle.trim().length > 0;

  return (
    <div className="surface-panel p-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl space-y-3">
          {label ? <p className="section-label">{label}</p> : null}
          {hasTitle || hasSubtitle ? (
            <div>
              {hasTitle ? <h1 className="page-title">{title}</h1> : null}
              {hasSubtitle ? (
                <p className="page-subtitle mt-3">{subtitle}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  hint: string;
  tone?: "brand" | "success" | "warning" | "neutral";
  onClick?: () => void;
  selected?: boolean;
};

export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
  onClick,
  selected = false,
}: StatCardProps) {
  const renderToneIcon = () => {
    switch (tone) {
      case "success":
        return (
          <span
            className="text-emerald-600 bg-emerald-50 p-1.5 rounded-full flex-shrink-0"
            title="Success / Active"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </span>
        );
      case "warning":
        return (
          <span
            className="text-amber-600 bg-amber-50 p-1.5 rounded-full flex-shrink-0"
            title="Warning / Action required"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </span>
        );
      case "neutral":
        return (
          <span
            className="text-slate-500 bg-slate-50 p-1.5 rounded-full flex-shrink-0"
            title="Neutral / Count"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </span>
        );
      case "brand":
      default:
        return (
          <span
            className="text-indigo-600 bg-indigo-50 p-1.5 rounded-full flex-shrink-0"
            title="Key event / Brand"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </span>
        );
    }
  };

  return (
    <article
      className={`kpi-card ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]" : ""} ${selected ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] ring-2 ring-[color:var(--brand-ring)]" : ""}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? selected : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)] break-words">
              {label}
            </span>
            {hint ? (
              <InfoPopover content={hint} label={`Info about ${label}`} />
            ) : null}
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        {renderToneIcon()}
      </div>
    </article>
  );
}

type SectionCardProps = {
  label?: string;
  title: string;
  description?: string;
  descriptionDisplay?: "inline" | "popover";
  actions?: ReactNode;
  children: ReactNode;
  variant?: "default" | "muted";
  className?: string;
};

type InfoPopoverProps = {
  content: ReactNode;
  label?: string;
  align?: "left" | "right";
};

export function InfoPopover({
  content,
  label = "Show section information",
  align = "left",
}: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
      >
        i
      </button>
      {open ? (
        <span
          id={popoverId}
          role="tooltip"
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-[color:var(--border)] bg-white p-4 text-sm leading-6 text-[color:var(--text-muted)] shadow-xl`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

type HeadingWithInfoProps = {
  title: string;
  description: ReactNode;
  titleClassName?: string;
  infoLabel?: string;
};

export function HeadingWithInfo({
  title,
  description,
  titleClassName = "text-2xl font-semibold tracking-tight text-slate-900",
  infoLabel,
}: HeadingWithInfoProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <h2 className={titleClassName}>{title}</h2>
      <InfoPopover content={description} label={infoLabel} />
    </div>
  );
}

export function SectionCard({
  label,
  title,
  description,
  descriptionDisplay = "inline",
  actions,
  children,
  variant = "default",
  className,
}: SectionCardProps) {
  const surfaceClassName =
    variant === "muted" ? "surface-muted p-6" : "surface-card p-6";

  return (
    <section
      className={`${surfaceClassName}${className ? ` ${className}` : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          {label ? <p className="section-label">{label}</p> : null}
          {description && descriptionDisplay === "popover" ? (
            <HeadingWithInfo title={title} description={description} />
          ) : (
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
          )}
          {description && descriptionDisplay !== "popover" ? (
            <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

type SplitPanelProps = {
  main: ReactNode;
  aside: ReactNode;
};

export function SplitPanel({ main, aside }: SplitPanelProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
      <div>{main}</div>
      <aside className="space-y-6">{aside}</aside>
    </section>
  );
}

type InfoCardProps = {
  label: string;
  children: ReactNode;
};

export function InfoCard({ label, children }: InfoCardProps) {
  return (
    <div className="surface-card p-5">
      <p className="section-label">{label}</p>
      <div className="mt-4 text-sm leading-7 text-[color:var(--text-muted)]">
        {children}
      </div>
    </div>
  );
}

type FormLabelProps = {
  children: ReactNode;
  required?: boolean;
};

export function FormLabel({ children, required = false }: FormLabelProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{children}</span>
      {required ? <span className="text-[color:var(--danger)]">*</span> : null}
    </span>
  );
}
