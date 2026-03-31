"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { exchangeCodeForToken, getReturnTo, clearReturnTo, validateState } from "@/lib/tidal-auth";

export default function CallbackClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const state = searchParams.get("state");

    if (errorParam) {
      setError(`Autorizzazione negata: ${errorParam}`);
      return;
    }

    if (!validateState(state)) {
      setError("State mismatch — possibile attacco CSRF.");
      return;
    }

    if (!code) {
      setError("Parametro code mancante nella risposta TIDAL.");
      return;
    }

    exchangeCodeForToken(code)
      .then(() => {
        const returnTo = getReturnTo();
        clearReturnTo();
        router.replace(returnTo);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Errore sconosciuto";
        setError(message);
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-sm w-full mx-4 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-lg space-y-4">
          <h1 className="text-lg font-semibold text-red-400">
            Autenticazione fallita
          </h1>
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 rounded text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            Torna alla home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <svg
          className="animate-spin h-8 w-8 text-[var(--accent)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm text-[var(--muted)]">Connessione a TIDAL...</p>
      </div>
    </div>
  );
}
