import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

export interface LovedCache {
  ids: string[];
  lastCheckedAt: string;
}

function cacheKey(userId: string): string {
  return `loved_cache:${userId}`;
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return Response.json({ cache: null });

  const cache = await getRedis().get<LovedCache>(cacheKey(userId));
  return Response.json({ cache: cache ?? null });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { userId: string } & LovedCache;
  const { userId, ids, lastCheckedAt } = body;
  if (!userId || !ids || !lastCheckedAt) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  await getRedis().set(cacheKey(userId), { ids, lastCheckedAt });
  return Response.json({ ok: true });
}
