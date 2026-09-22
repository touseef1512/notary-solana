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
  const { getTelegramUpdates, sendTelegramMessage } = await import('../lib/telegram');
  const { subscribeChat, unsubscribeChat, getSubscription } = await import('../lib/telegram-subscribers');

  const updates = await getTelegramUpdates();
  let maxUpdateId = 0;

  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];
    if (update.update_id > maxUpdateId) {
      maxUpdateId = update.update_id;
    }

    if (update.message && update.message.chat && update.message.text) {
      const chatId = update.message.chat.id.toString();
      const text = update.message.text.trim();

      console.log(`Received message from ${chatId}: ${text}`);

      let reply = "";
      if (text === "/start") {
        await subscribeChat(chatId);
        reply = "Subscribed. You'll get a daily briefing and risk alerts here. Send /status to check, /stop to unsubscribe.";
      } else if (text === "/stop") {
        await unsubscribeChat(chatId);
        reply = "Unsubscribed \u2014 you won't get any more messages. Send /start to resubscribe.";
      } else if (text === "/status") {
        const sub = await getSubscription(chatId);
        if (sub) {
          const dateStr = new Date(sub.subscribedAt * 1000).toISOString().split('T')[0];
          reply = `Subscribed since ${dateStr}`;
        } else {
          reply = "Not subscribed \u2014 send /start";
        }
      } else {
        reply = "Sorry, I didn't understand that. Try /status or /stop.";
      }

      const sendRes = await sendTelegramMessage(chatId, reply);
      if (sendRes.ok) {
        console.log(`  -> Replied successfully`);
      } else {
        console.log(`  -> Failed to reply: ${sendRes.error ?? "unknown error"}`);
      }
    }
  }

  if (maxUpdateId > 0) {
    // Ack updates
    await getTelegramUpdates(maxUpdateId + 1);
    console.log(`Acknowledged updates up to ${maxUpdateId}`);
  } else {
    console.log(`No new updates.`);
  }
}

run().catch((e: unknown) => {
  console.error("Error polling Telegram updates:", e);
  process.exitCode = 1;
});
