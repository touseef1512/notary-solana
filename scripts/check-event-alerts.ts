import fs from 'fs';
import path from 'path';

function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
}
loadEnv();

async function run(): Promise<void> {
  const { getAllSubscribers } = await import('../lib/telegram-subscribers');
  const { getLiquidationRiskAlerts } = await import('../lib/alert-engine');
  const { trackAlertState } = await import('../lib/alert-state');
  const { sendTelegramMessage } = await import('../lib/telegram');

  const subscribers = await getAllSubscribers();
  console.log(`Checking event alerts for ${subscribers.length} subscribers...`);

  for (let i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i];
    if (!sub.walletAddress) {
      console.log(`[${sub.chatId}] Skipped (no wallet)`);
      continue;
    }

    try {
      const alerts = await getLiquidationRiskAlerts(sub.walletAddress);
      const escalated = await trackAlertState(sub.walletAddress, alerts);
      
      if (escalated.length === 0) {
        console.log(`[${sub.chatId}] OK (0 escalated)`);
        continue;
      }

      for (let j = 0; j < escalated.length; j++) {
        const alert = escalated[j];
        const asset = alert.title.replace('Liquidation Risk: ', '');
        const healthStr = alert.note.replace('Gap-stressed health factor: ', '');
        const msg = `\u26a0\ufe0f Update on your ${asset} loan: gap-stressed health just dropped to ${healthStr} \u2014 please review your position.`;
        
        const res = await sendTelegramMessage(sub.chatId, msg);
        if (res.ok) {
          console.log(`[${sub.chatId}] Sent escalation: ${msg}`);
        } else {
          console.log(`[${sub.chatId}] ERROR sending escalation: ${res.error ?? 'unknown'}`);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[${sub.chatId}] EXCEPTION: ${msg}`);
    }
  }
}

run().catch((e: unknown) => {
  console.error("Error checking event alerts:", e);
  process.exitCode = 1;
});
