"use client";

import type { TidalToken } from "./types";

const SESSION_TOKEN_KEY = "tidal_token";
const SESSION_VERIFIER_KEY = "tidal_pkce_verifier";
const SESSION_RETURN_KEY = "tidal_return_to";

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateCodeVerifier(length = 96): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ── Token storage ─────────────────────────────────────────────────────────────

export function getStoredToken(): TidalToken | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw) as TidalToken;
    if (Date.now() >= token.expires_at) {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function saveToken(token: TidalToken): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify(token));
}

export function clearToken(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export async function redirectToTidal(returnTo = "/"): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_TIDAL_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_TIDAL_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("TIDAL client ID or redirect URI not configured");
  }

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = crypto.randomUUID();

  sessionStorage.setItem(SESSION_VERIFIER_KEY, verifier);
  sessionStorage.setItem(SESSION_RETURN_KEY, returnTo);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "playlists.read playlists.write user.read",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  window.location.href = `https://login.tidal.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string
): Promise<TidalToken> {
  const clientId = process.env.NEXT_PUBLIC_TIDAL_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_TIDAL_REDIRECT_URI;
  const verifier = sessionStorage.getItem(SESSION_VERIFIER_KEY);

  if (!clientId || !redirectUri) {
    throw new Error("TIDAL client ID or redirect URI not configured");
  }
  if (!verifier) {
    throw new Error("Missing PKCE verifier");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  });

  const res = await fetch("https://auth.tidal.com/v1/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  sessionStorage.removeItem(SESSION_VERIFIER_KEY);

  const token: TidalToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  saveToken(token);
  return token;
}

export function getReturnTo(): string {
  if (typeof window === "undefined") return "/";
  return sessionStorage.getItem(SESSION_RETURN_KEY) ?? "/";
}

export function clearReturnTo(): void {
  sessionStorage.removeItem(SESSION_RETURN_KEY);
}
