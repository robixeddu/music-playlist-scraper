"use client";

import { useState, type ReactNode } from "react";

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

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="flex items-center bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center gap-3 px-5 py-4 text-left cursor-pointer"
          aria-expanded={open}
        >
          <svg
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
        </button>
        {action && (
          <div className="pr-5 shrink-0">
            {action}
          </div>
        )}
      </div>
      {open && <div className="bg-[var(--background)]">{children}</div>}
    </div>
  );
}
