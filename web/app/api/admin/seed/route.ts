import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return Response.json({ error: "ADMIN_SECRET not configured" }, { status: 500 });
  }

  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    userId: string;
    playlists: Array<{ type: string; slug: string; playlistId: string }>;
  };

  if (!body.userId || !Array.isArray(body.playlists) || body.playlists.length === 0) {
    return Response.json({ error: "Missing userId or playlists" }, { status: 400 });
  }

  const redis = getRedis();
  const ops = body.playlists.map(({ type, slug, playlistId }) =>
    redis.set(`playlist:${body.userId}:${type}:${slug}`, playlistId)
  );

  await Promise.all(ops);

  return Response.json({ ok: true, seeded: body.playlists.length });
}
