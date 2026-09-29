import fsPromises from "fs/promises";

// TIDAL internal app credentials — same client used by tidalapi and similar community projects.
// These bypass third-party scope restrictions (r_usr is available).
const CLIENT_ID = "fX2JxdmntZWK0ixT";
const CLIENT_SECRET = "1Nn9AfDAjxrgJFYbKNWLeAyKGVGmINuXPPLHVXAvxAg==";
const DEVICE_AUTH_URL = "https://auth.tidal.com/v1/oauth2/device_authorization";
const TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token";
const TOKEN_FILE = "./.tidal_internal_token.json";

const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  userId?: string;
}

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

const parseTokenResponse = (data: any, existingUserId?: string): TokenData => ({
  access_token: data.access_token,
  refresh_token: data.refresh_token,
  expires_at: Date.now() + data.expires_in * 1000,
  userId: data.user?.userId ? String(data.user.userId) : existingUserId,
});

const refreshToken = async (token: TokenData): Promise<TokenData> => {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: token.refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status} — ${await res.text()}`);
  return parseTokenResponse(await res.json(), token.userId);
};

const loginWithDevice = async (): Promise<TokenData> => {
  const deviceRes = await fetch(DEVICE_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: "r_usr w_usr w_sub" }),
  });
  if (!deviceRes.ok) throw new Error(`Device auth request failed: ${deviceRes.status} — ${await deviceRes.text()}`);

  const { deviceCode, userCode, verificationUri, verificationUriComplete, expiresIn, interval } = await deviceRes.json();

  const url = verificationUriComplete
    ? `https://${verificationUriComplete}`
    : `https://${verificationUri}`;
  console.log(`\n🔐 TIDAL device authorization required:`);
  console.log(`   Open: ${url}`);
  console.log(`   Waiting for confirmation...\n`);

  const deadline = Date.now() + expiresIn * 1000;
  const pollMs = Math.max((interval ?? 2), 2) * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));

    const pollRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        scope: "r_usr w_usr w_sub",
      }),
    });

    const data: any = await pollRes.json();

    if (!pollRes.ok) {
      if (data.error === "authorization_pending") continue;
      throw new Error(`Token poll error: ${JSON.stringify(data)}`);
    }

    const token = parseTokenResponse(data);
    await saveToken(token);
    console.log("✅ TIDAL internal authentication successful.\n");
    return token;
  }

  throw new Error("Device authorization timed out — restart the script to try again");
};

export const getInternalAccessToken = async (): Promise<string> => {
  let token = await loadToken();

  if (!token) return (await loginWithDevice()).access_token;

  if (Date.now() > token.expires_at - 60_000) {
    try {
      const refreshed = await refreshToken(token);
      await saveToken(refreshed);
      return refreshed.access_token;
    } catch {
      console.error("❌ Internal token refresh failed, re-authentication required");
      return (await loginWithDevice()).access_token;
    }
  }

  return token.access_token;
};

export const getInternalUserId = async (): Promise<string> => {
  const token = await loadToken() ?? await loginWithDevice();
  if (token.userId) return token.userId;
  // Fallback: decode JWT
  try {
    const payload = JSON.parse(
      Buffer.from(token.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    );
    const id = payload.sub ?? payload.userId ?? payload.uid;
    if (id) {
      token.userId = String(id);
      await saveToken(token);
      return token.userId;
    }
  } catch {}
  throw new Error("Could not determine TIDAL user ID from internal token");
};
