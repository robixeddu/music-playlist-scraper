import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

function key(userId: string, type: string, slug: string): string {
  return `playlist:${userId}:${type}:${slug}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get("userId");
  const type = searchParams.get("type");
  const slug = searchParams.get("slug");

  if (!userId || !type || !slug) {
    return Response.json({ playlistId: null });
  }

  const playlistId = await getRedis().get<string>(key(userId, type, slug));
  return Response.json({ playlistId: playlistId ?? null });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    userId: string;
    type: string;
    slug: string;
    playlistId: string;
  };
  const { userId, type, slug, playlistId } = body;

  if (!userId || !type || !slug || !playlistId) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  await getRedis().set(key(userId, type, slug), playlistId);
  return Response.json({ ok: true });
}
