import { Redis } from '@upstash/redis';

const REDIS_TIMEOUT_MS = 2000;

let redisClient: Redis | null = null;
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  redisClient = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Redis timeout')), REDIS_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface TelegramSubscriber {
  chatId: string;
  walletAddress: string | null;
  subscribedAt: number;
}

export async function subscribeChat(chatId: string, walletAddress?: string): Promise<void> {
  if (!redisClient) throw new Error('Redis not configured: KV_REST_API_URL/KV_REST_API_TOKEN missing');
  const sub: TelegramSubscriber = {
    chatId,
    walletAddress: walletAddress ?? null,
    subscribedAt: Math.floor(Date.now() / 1000)
  };
  
  await withTimeout(redisClient.set(`notary:tg:sub:${chatId}`, JSON.stringify(sub)));
  await withTimeout(redisClient.sadd(`notary:tg:sub:index`, chatId));
}

export async function updateWalletAddress(chatId: string, walletAddress: string): Promise<void> {
  if (!redisClient) throw new Error('Redis not configured: KV_REST_API_URL/KV_REST_API_TOKEN missing');
  const sub = await getSubscription(chatId);
  if (!sub) {
    throw new Error('Not subscribed');
  }
  sub.walletAddress = walletAddress;
  await withTimeout(redisClient.set(`notary:tg:sub:${chatId}`, JSON.stringify(sub)));
}

export async function unsubscribeChat(chatId: string): Promise<void> {
  if (!redisClient) throw new Error('Redis not configured: KV_REST_API_URL/KV_REST_API_TOKEN missing');
  await withTimeout(redisClient.del(`notary:tg:sub:${chatId}`));
  await withTimeout(redisClient.srem(`notary:tg:sub:index`, chatId));
}

export async function getSubscription(chatId: string): Promise<TelegramSubscriber | null> {
  if (!redisClient) throw new Error('Redis not configured: KV_REST_API_URL/KV_REST_API_TOKEN missing');
  const data = await withTimeout(redisClient.get<TelegramSubscriber>(`notary:tg:sub:${chatId}`));
  return data;
}

export async function getAllSubscribers(): Promise<TelegramSubscriber[]> {
  if (!redisClient) throw new Error('Redis not configured: KV_REST_API_URL/KV_REST_API_TOKEN missing');
  const chatIds = await withTimeout(redisClient.smembers('notary:tg:sub:index'));
  if (chatIds.length === 0) return [];
  
  const keys = chatIds.map((id) => `notary:tg:sub:${id}`);
  const results = await withTimeout(redisClient.mget<TelegramSubscriber[]>(...keys));
  
  const subs: TelegramSubscriber[] = [];
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (res) subs.push(res);
  }
  return subs;
}

export async function isWalletLinked(walletAddress: string): Promise<boolean> {
  const subs = await getAllSubscribers();
  return subs.some(sub => sub.walletAddress === walletAddress);
}
