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
  const { subscribeChat, unsubscribeChat, getSubscription, updateWalletAddress } = await import('../lib/telegram-subscribers');

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
      } else if (text.startsWith("/wallet ")) {
        const address = text.substring(8).trim();
        try {
          await updateWalletAddress(chatId, address);
          reply = `Wallet linked: ${address}. Your daily briefing will now include your Kamino loan status.`;
        } catch (err) {
          if (err instanceof Error && err.message === 'Not subscribed') {
            reply = "Send /start first to subscribe, then link your wallet.";
          } else {
            reply = "An error occurred while linking your wallet.";
          }
        }
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
      } else if (text.toLowerCase().startsWith("/cost ")) {
        const match = text.match(/^\/cost\s+(\S+)\s+([\d.]+)$/i);
        if (!match) {
          reply = "Usage: /cost SYMBOL AMOUNT \u2014 e.g. /cost AAPLx 500";
        } else {
          try {
            const symbol = match[1];
            const amount = parseFloat(match[2]);
            const { KNOWN_ASSETS } = await import('../lib/known-assets');
            const asset = KNOWN_ASSETS.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());
            
            if (!asset) {
              reply = "The cost check isn't available for that symbol right now.";
            } else {
              const { getTradeCost, ALLOWED_USD_SIZES } = await import('../lib/trade-cost');
              if (!ALLOWED_USD_SIZES.includes(amount)) {
                reply = `Supported sizes: ${ALLOWED_USD_SIZES.map(s => '$' + s.toLocaleString()).join(', ')}. Try /cost ${asset.symbol} ${ALLOWED_USD_SIZES[0]}.`;
              } else {
                const result = await getTradeCost(asset.mintAddress, amount);
                if (result.status === "ok") {
                  const impactStr = result.impactPercent !== null && result.impactPercent < 0.01 ? "under 0.01" : result.impactPercent?.toFixed(2);
                  const venuesStr = result.venues.length > 0 ? `would go through ${result.venues.join(', ')}` : "would go through the available pools";
                  reply = `Buying $${result.usdAmount.toLocaleString()} of ${asset.symbol} ${venuesStr}. Estimated price impact: ${impactStr}%.`;
                } else {
                  reply = "The cost check isn't available for that symbol right now.";
                }
              }
            }
          } catch {
            reply = "The cost check isn't available for that symbol right now.";
          }
        }
      } else if (!text.startsWith("/")) {
        try {
          const sub = await getSubscription(chatId);
          let holdings: { mintAddress: string; shares: number }[] = [];
          let loanRisk: Awaited<ReturnType<typeof import('../lib/kamino-risk').getKaminoRiskData>> | undefined = undefined;
          if (sub && sub.walletAddress) {
            try {
              const { getTokenizedStockHoldings } = await import('../lib/solana');
              const rawHoldings = await getTokenizedStockHoldings(sub.walletAddress);
              holdings = rawHoldings.map(h => ({
                mintAddress: h.mintAddress,
                shares: h.balance
              }));
            } catch {
              // ignore fetch failure
            }
            try {
              const { getKaminoRiskData } = await import('../lib/kamino-risk');
              loanRisk = await getKaminoRiskData(sub.walletAddress);
            } catch {
              // ignore fetch failure — askNotary will fall back gracefully
            }
          }
          
          const { askNotary } = await import('../lib/ask-notary');
          const response = await askNotary(text, { holdings, loanRisk });
          reply = response.answer;
        } catch {
          reply = "Sorry, I couldn't process that question right now. Try /status, /wallet <address>, or /cost SYMBOL AMOUNT.";
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
