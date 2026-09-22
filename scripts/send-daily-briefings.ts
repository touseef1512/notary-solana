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
  const { sendBriefingToChat } = await import('../lib/telegram-briefing');
  const { getAllSubscribers } = await import('../lib/telegram-subscribers');

  const subscribers = await getAllSubscribers();
  console.log(`Starting daily briefing for ${subscribers.length} subscribers...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i];
    try {
      const res = await sendBriefingToChat(sub.chatId);
      if (res.ok) {
        console.log(`[${sub.chatId}] OK`);
        successCount++;
      } else {
        console.log(`[${sub.chatId}] ERROR: ${res.error ?? 'unknown error'}`);
        failCount++;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[${sub.chatId}] EXCEPTION: ${msg}`);
      failCount++;
    }
  }

  console.log(`\nDaily briefing complete.`);
  console.log(`Total: ${subscribers.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  if (subscribers.length > 0 && successCount === 0) {
    process.exitCode = 1;
  }
}

run().catch((e: unknown) => {
  console.error("Error sending daily briefings:", e);
  process.exitCode = 1;
});
