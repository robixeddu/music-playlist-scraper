"use client";

interface Track {
  artist: string;
  title: string;
  tidalId?: string | null;
}

export default function TrackList({ tracks }: { tracks: Track[] }) {
  return (
    <ul className="px-5 py-2 space-y-1 border-t border-[var(--border)] bg-[var(--background)]">
      {[...tracks].reverse().map((t, i) => (
        <li
          key={i}
          className={`text-xs py-0.5 flex gap-2 ${
            t.tidalId ? "text-[var(--foreground)]" : "text-[var(--muted)]"
          }`}
        >
          <span className="font-medium truncate shrink-0 max-w-[45%]">{t.artist}</span>
          <span className="text-[var(--muted)]">—</span>
          <span className="truncate">{t.title}</span>
          {!t.tidalId && (
            <span className="ml-auto shrink-0 text-[10px] text-[var(--muted)] italic">no TIDAL</span>
          )}
        </li>
      ))}
    </ul>
  );
}
