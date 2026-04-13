"use client";

import { useState, useId, type ReactNode } from "react";

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  action?: ReactNode;
}

export default function Accordion({
  title,
  children,
  defaultOpen = false,
  action,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="border border-[var(--border)] rounded-lg">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, a")) return;
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((v) => !v); }}
        className={`flex items-center cursor-pointer bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors rounded-t-lg${
          open
            ? " sticky top-14 z-20 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-sm"
            : " rounded-b-lg"
        }`}
      >
        <div className="flex-1 flex items-center gap-3 px-5 py-4">
          <svg
            aria-hidden="true"
            className={`w-3 h-3 text-[var(--muted)] shrink-0 transition-transform duration-150 ${
              open ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-base">{title}</span>
        </div>
        {action && (
          <div className="pr-5 shrink-0">
            {action}
          </div>
        )}
      </div>
      <div id={contentId} className={`relative z-0 bg-[var(--background)] rounded-b-lg${open ? "" : " hidden"}`}>{children}</div>
    </div>
  );
}
