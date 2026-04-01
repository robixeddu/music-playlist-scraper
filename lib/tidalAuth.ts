import crypto from "crypto";
import http from "http";
import fsPromises from "fs/promises";
import { logError } from "./logger.js";

// Required env vars: TIDAL_CLIENT_ID, TIDAL_CLIENT_SECRET
// Register your app at https://developer.tidal.com/

const TOKEN_FILE = "./.tidal_token.json";
const CLI_PORT = parseInt(process.env.TIDAL_CLI_PORT ?? "3001", 10);
const REDIRECT_URI = `http://localhost:${CLI_PORT}/callback/tidal`;
const AUTH_URL = "https://login.tidal.com/authorize";
const TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token";

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

const CLIENT_ID = process.env.TIDAL_CLIENT_ID!;
const CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET!;

const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

const loadToken = async (): Promise<TokenData | null> => {
  try {
    const data = await fsPromises.readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
};

const saveToken = async (token: TokenData): Promise<void> => {
  await fsPromises.writeFile(TOKEN_FILE, JSON.stringify(token, null, 2));
};

const exchangeToken = async (params: URLSearchParams): Promise<TokenData> => {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: params,
  });

  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);

  const data: any = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
};

const loginWithPKCE = async (): Promise<TokenData> => {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "playlists.write",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  console.log(`\n🔐 Open this URL to authenticate with TIDAL:\n\n${AUTH_URL}?${params}\n`);
  console.log(`Waiting for authentication on http://localhost:${CLI_PORT} ...\n`);

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${CLI_PORT}`);
      const code = url.searchParams.get("code");

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Authentication successful! You can close this tab.</h1>");
        server.close();
        resolve(code);
      } else {
        server.close();
        reject(new Error("No authorization code received"));
      }
    });
    server.listen(CLI_PORT);
  });

  const token = await exchangeToken(new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: verifier,
  }));

  await saveToken(token);
  console.log("✅ TIDAL authentication successful.\n");
  return token;
};

export const getAccessToken = async (): Promise<string> => {
  let token = await loadToken();

  if (!token) return (await loginWithPKCE()).access_token;

  if (Date.now() > token.expires_at - 60_000) {
    try {
      const refreshed = await exchangeToken(new URLSearchParams({
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        refresh_token: token.refresh_token,
      }));
      await saveToken(refreshed);
      return refreshed.access_token;
    } catch {
      logError("token refresh", "Re-authentication required");
      return (await loginWithPKCE()).access_token;
    }
  }

  return token.access_token;
};
