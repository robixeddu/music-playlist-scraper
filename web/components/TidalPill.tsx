"use client";

import { useState, useEffect } from "react";
import { getStoredToken, clearToken, redirectToTidal } from "@/lib/tidal-auth";

export default function TidalPill() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setConnected(getStoredToken() !== null);
  }, []);

  // Listen for token changes (e.g. after callback redirect)
  useEffect(() => {
    function checkToken() {
      setConnected(getStoredToken() !== null);
    }
    window.addEventListener("focus", checkToken);
    return () => window.removeEventListener("focus", checkToken);
  }, []);

  function handleConnect() {
    redirectToTidal("/").catch(console.error);
  }

  function handleDisconnect() {
    clearToken();
    setConnected(false);
  }

  if (connected) {
    return (
      <button
        onClick={handleDisconnect}
        title="Clicca per disconnetterti"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
        Connesso
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
    >
      Connetti TIDAL
    </button>
  );
}
