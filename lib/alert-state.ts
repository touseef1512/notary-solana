import { Redis } from '@upstash/redis';
import { NotaryAlert } from './alert-engine';

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

function getAlertKey(alert: NotaryAlert): string {
  if (alert.kind === 'liquidation-risk' && alert.obligationPubkey) {
    return `${alert.kind}:${alert.obligationPubkey}`;
  }
  return `${alert.kind}:${alert.assetSymbol ?? 'unknown'}`;
}

const severityValue: Record<string, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

export async function trackAlertState(walletAddress: string, alerts: NotaryAlert[]): Promise<NotaryAlert[]> {
  if (!redisClient) throw new Error('Redis not configured: KV_REST_API_URL/KV_REST_API_TOKEN missing');
  
  const redisKey = `notary:alertstate:${walletAddress}`;
  const data = await withTimeout(redisClient.get<Record<string, string>>(redisKey));
  const previousState = data ?? {};
  
  const currentState: Record<string, string> = {};
  const escalatedAlerts: NotaryAlert[] = [];
  
  for (let i = 0; i < alerts.length; i++) {
    const alert = alerts[i];
    const key = getAlertKey(alert);
    currentState[key] = alert.severity;
    
    const prevSeverity = previousState[key];
    if (!prevSeverity) {
      if (alert.severity === 'warning' || alert.severity === 'critical') {
        escalatedAlerts.push(alert);
      }
    } else {
      const prevValue = severityValue[prevSeverity] ?? 0;
      const currValue = severityValue[alert.severity] ?? 0;
      if (currValue > prevValue) {
        escalatedAlerts.push(alert);
      }
    }
  }
  
  await withTimeout(redisClient.set(redisKey, JSON.stringify(currentState)));
  return escalatedAlerts;
}
