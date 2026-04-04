import "dotenv/config";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

const redisKey = (userId: string, type: string, slug: string) =>
  `playlist:${userId}:${type}:${slug}`;

const genreIndexKey = (userId: string) => `playlist:${userId}:genre:__index`;

export async function getSeededGenreSlugs(userId: string): Promise<string[]> {
  try {
    return (await getRedis().get<string[]>(genreIndexKey(userId))) ?? [];
  } catch { return []; }
}

export async function setSeededGenreSlugs(userId: string, slugs: string[]): Promise<void> {
  try { await getRedis().set(genreIndexKey(userId), slugs); } catch {}
}

export async function getPlaylistId(
  userId: string,
  type: string,
  slug: string
): Promise<string | null> {
  try {
    return await getRedis().get<string>(redisKey(userId, type, slug));
  } catch {
    return null;
  }
}

export async function setPlaylistId(
  userId: string,
  type: string,
  slug: string,
  id: string
): Promise<void> {
  try {
    await getRedis().set(redisKey(userId, type, slug), id);
  } catch {}
}

export async function deletePlaylistKeys(
  userId: string,
  type: string,
  slug: string
): Promise<void> {
  try {
    const redis = getRedis();
    await Promise.all([
      redis.del(redisKey(userId, type, slug)),
      redis.del(`${redisKey(userId, type, slug)}:ids`),
    ]);
  } catch {}
}

export async function setImportedIds(
  userId: string,
  type: string,
  slug: string,
  ids: string[]
): Promise<void> {
  try {
    await getRedis().set(`${redisKey(userId, type, slug)}:ids`, ids);
  } catch {}
}
