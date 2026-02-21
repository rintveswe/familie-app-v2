import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";
import { AppData } from "@/lib/shared/types";

const DATA_KEY = "familie-app-v2:data:v1";
const FILE_PATH = path.join(process.cwd(), ".data", "familie-app-data.json");

const defaultData: AppData = {
  events: [],
  subscriptions: [],
  sentReminders: [],
};

const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export async function getData(): Promise<AppData> {
  if (redis) {
    const remote = await redis.get<AppData>(DATA_KEY);
    return sanitizeData(remote ?? defaultData);
  }

  try {
    const raw = await readFile(FILE_PATH, "utf8");
    return sanitizeData(JSON.parse(raw) as AppData);
  } catch {
    return defaultData;
  }
}

export async function setData(next: AppData) {
  const cleaned = sanitizeData(next);
  if (redis) {
    await redis.set(DATA_KEY, cleaned);
    return;
  }

  await mkdir(path.dirname(FILE_PATH), { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(cleaned, null, 2), "utf8");
}

export async function updateData(updater: (current: AppData) => AppData) {
  const current = await getData();
  const next = updater(current);
  await setData(next);
  return next;
}

function sanitizeData(input: AppData): AppData {
  return {
    events: Array.isArray(input.events) ? input.events : [],
    subscriptions: Array.isArray(input.subscriptions) ? input.subscriptions : [],
    sentReminders: Array.isArray(input.sentReminders) ? input.sentReminders : [],
  };
}
