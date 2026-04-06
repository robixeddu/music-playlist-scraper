import crypto from "crypto";
import http from "http";
import fsPromises from "fs/promises";

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
  userId?: string;
}

function extractUserIdFromJwt(token: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    );
    const id = payload.sub ?? payload.userId ?? payload.uid ?? payload.id;
    return id ? String(id) : null;
  } catch {
    return null;
  }
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

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token request failed: ${res.status} — ${body}`);
  }

  const data: any = await res.json();
  const rawUserId = data.user?.userId ?? data.user_id ?? extractUserIdFromJwt(data.access_token);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    userId: rawUserId ? String(rawUserId) : undefined,
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
      const error = url.searchParams.get("error");

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Authentication successful! You can close this tab.</h1>");
        server.close();
        resolve(code);
      } else if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>Authentication failed: ${error}</h1>`);
        server.close();
        reject(new Error(`TIDAL auth error: ${error}`));
      }
      // ignore other requests (e.g. favicon.ico)
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(
          `Port ${CLI_PORT} is already in use — stop the /web dev server first, then retry.`
        ));
      } else {
        reject(err);
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
      // Preserve userId across refreshes (refresh response may not include it)
      if (!refreshed.userId && token.userId) refreshed.userId = token.userId;
      await saveToken(refreshed);
      return refreshed.access_token;
    } catch {
      console.error("❌ Error during token refresh: Re-authentication required");
      return (await loginWithPKCE()).access_token;
    }
  }

  return token.access_token;
};

export const getUserId = async (): Promise<string> => {
  const token = await loadToken();
  if (token?.userId) return token.userId;
  // Try to extract from current access_token
  const accessToken = await getAccessToken();
  const id = extractUserIdFromJwt(accessToken);
  if (id) {
    // Cache it for next time
    const stored = await loadToken();
    if (stored) { stored.userId = id; await saveToken(stored); }
    return id;
  }
  return "unknown";
};
