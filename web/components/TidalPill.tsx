"use client";

import { usePathname } from "next/navigation";
import { redirectToTidal } from "@/lib/tidal-auth";
import { useTidalConnected } from "@/hooks/useTidalConnected";
import { useT } from "./LangProvider";

export default function TidalPill() {
  const tr = useT();
  const pathname = usePathname();
  const [connected, disconnect] = useTidalConnected();

  function handleConnect() {
    redirectToTidal(pathname).catch(console.error);
  }

  if (connected) {
    return (
      <button
        onClick={disconnect}
        title={tr.disconnectTitle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
        {tr.connected}
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
    >
      {tr.connectTidal}
    </button>
  );
}
