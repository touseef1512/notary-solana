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
  const chatId = process.argv[2];
  if (!chatId) {
    console.error("Usage: npx tsx scripts/send-briefing-once.ts <chatId>");
    process.exitCode = 1;
    return;
  }
  
  const { sendBriefingToChat, buildBriefingMessage } = await import('../lib/telegram-briefing');
  const { getSubscription } = await import('../lib/telegram-subscribers');
  
  const res = await sendBriefingToChat(chatId);
  console.log(`Briefing sent to ${chatId}: ok=${res.ok} error=${res.error ?? 'none'}`);
  
  const sub = await getSubscription(chatId);
  if (sub) {
    const msg = await buildBriefingMessage(sub.walletAddress);
    console.log(`\n--- MESSAGE CONTENT ---\n${msg}\n-----------------------`);
  }
}

run().catch((e: unknown) => {
  console.error("Error sending briefing:", e);
  process.exitCode = 1;
});
