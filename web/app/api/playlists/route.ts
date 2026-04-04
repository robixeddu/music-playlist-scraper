import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

function playlistKey(userId: string, type: string, slug: string): string {
  return `playlist:${userId}:${type}:${slug}`;
}

function idsKey(userId: string, type: string, slug: string): string {
  return `playlist:${userId}:${type}:${slug}:ids`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get("userId");
  const type = searchParams.get("type");
  const slug = searchParams.get("slug");

  if (!userId || !type || !slug) {
    return Response.json({ playlistId: null, importedIds: null });
  }

  const redis = getRedis();
  const [playlistId, importedIds] = await Promise.all([
    redis.get<string>(playlistKey(userId, type, slug)),
    redis.get<string[]>(idsKey(userId, type, slug)),
  ]);

  return Response.json({
    playlistId: playlistId ?? null,
    importedIds: importedIds ?? null,
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get("userId");
  const type = searchParams.get("type");
  const slug = searchParams.get("slug");
  if (!userId || !type || !slug) return Response.json({ error: "Missing fields" }, { status: 400 });
  const redis = getRedis();
  await Promise.all([redis.del(playlistKey(userId, type, slug)), redis.del(idsKey(userId, type, slug))]);
  return Response.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    userId: string;
    type: string;
    slug: string;
    playlistId?: string;
    importedIds?: string[];
  };
  const { userId, type, slug, playlistId, importedIds } = body;

  if (!userId || !type || !slug) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const redis = getRedis();
  const ops: Promise<unknown>[] = [];
  if (playlistId) ops.push(redis.set(playlistKey(userId, type, slug), playlistId));
  if (importedIds) ops.push(redis.set(idsKey(userId, type, slug), importedIds));
  await Promise.all(ops);

  return Response.json({ ok: true });
}
