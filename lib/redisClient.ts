import "dotenv/config";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

const redisKey = (userId: string, type: string, slug: string) =>
  `playlist:${userId}:${type}:${slug}`;

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
