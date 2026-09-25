import { subscribeChat, unsubscribeChat, getSubscription, updateWalletAddress } from './telegram-subscribers';
import { buildBriefingMessage } from './telegram-briefing';
import { KNOWN_ASSETS } from './known-assets';
import { getTradeCost, ALLOWED_USD_SIZES } from './trade-cost';
import { getTokenizedStockHoldings } from './solana';
import { getKaminoRiskData } from './kamino-risk';
import { askNotary } from './ask-notary';

export async function handleTelegramText(chatId: string, rawText: string): Promise<string> {
  try {
    const text = rawText.trim();
    if (!text) {
      return "Sorry, I didn't understand that. Send /help to see what I can do.";
    }

    const tokens = text.split(/\s+/);
    let firstToken = tokens[0].toLowerCase();
    
    if (firstToken.startsWith('/')) {
      const atIndex = firstToken.indexOf('@');
      if (atIndex !== -1) {
        firstToken = firstToken.substring(0, atIndex);
      }

      if (firstToken === '/start') {
        await subscribeChat(chatId);
        return "Subscribed. You'll get a daily briefing and risk alerts here. Send /status to check, /stop to unsubscribe.";
      } 
      
      if (firstToken === '/wallet') {
        const address = tokens.slice(1).join(" ").trim();
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
          return "That doesn't look like a Solana wallet address. Send /wallet followed by the address.";
        }
        try {
          await updateWalletAddress(chatId, address);
          return `Wallet linked: ${address}. Your daily briefing will now include your Kamino loan status.`;
        } catch (err) {
          if (err instanceof Error && err.message === 'Not subscribed') {
            return "Send /start first to subscribe, then link your wallet.";
          }
          return "An error occurred while linking your wallet.";
        }
      }
      
      if (firstToken === '/stop') {
        await unsubscribeChat(chatId);
        return "Unsubscribed — you won't get any more messages. Send /start to resubscribe.";
      }
      
      if (firstToken === '/status') {
        const sub = await getSubscription(chatId);
        if (sub) {
          const dateStr = new Date(sub.subscribedAt * 1000).toISOString().split('T')[0];
          return `Subscribed since ${dateStr}`;
        }
        return "Not subscribed — send /start";
      }

      if (firstToken === '/briefing') {
        const sub = await getSubscription(chatId);
        if (!sub) {
          return "Send /start first to subscribe.";
        }
        try {
          const message = await buildBriefingMessage(sub.walletAddress);
          return message;
        } catch {
          return "The briefing isn't available right now. Try again in a moment.";
        }
      }

      if (firstToken === '/help') {
        return "/briefing today's alerts, /wallet <address> link your wallet, /cost SYMBOL AMOUNT estimated price impact, /status, /stop. You can also just ask a question.";
      }

      if (firstToken === '/cost') {
        if (tokens.length !== 3 || !/^[\d.]+$/.test(tokens[2])) {
          return "Usage: /cost SYMBOL AMOUNT — e.g. /cost AAPLx 500";
        }
        try {
          const symbol = tokens[1];
          const amount = parseFloat(tokens[2]);
          const asset = KNOWN_ASSETS.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());
          
          if (!asset) {
            return "The cost check isn't available for that symbol right now.";
          } else {
            if (!ALLOWED_USD_SIZES.includes(amount)) {
              return `Supported sizes: ${ALLOWED_USD_SIZES.map(s => '$' + s.toLocaleString()).join(', ')}. Try /cost ${asset.symbol} ${ALLOWED_USD_SIZES[0]}.`;
            } else {
              const result = await getTradeCost(asset.mintAddress, amount);
              if (result.status === "ok") {
                const impactStr = result.impactPercent !== null && result.impactPercent < 0.01 ? "under 0.01" : result.impactPercent?.toFixed(2);
                const venuesStr = result.venues.length > 0 ? `would go through ${result.venues.join(', ')}` : "would go through the available pools";
                return `Buying $${result.usdAmount.toLocaleString()} of ${asset.symbol} ${venuesStr}. Estimated price impact: ${impactStr}%.`;
              } else {
                return "The cost check isn't available for that symbol right now.";
              }
            }
          }
        } catch {
          return "The cost check isn't available for that symbol right now.";
        }
      }

      return "Sorry, I didn't understand that. Send /help to see what I can do.";
    }

    // Not a command, treat as question
    try {
      const sub = await getSubscription(chatId);
      let holdings: { mintAddress: string; shares: number }[] = [];
      let loanRisk: Awaited<ReturnType<typeof getKaminoRiskData>> | undefined = undefined;
      
      if (sub && sub.walletAddress) {
        try {
          const rawHoldings = await getTokenizedStockHoldings(sub.walletAddress);
          holdings = rawHoldings.map(h => ({
            mintAddress: h.mintAddress,
            shares: h.balance
          }));
        } catch {
          // ignore fetch failure
        }
        try {
          loanRisk = await getKaminoRiskData(sub.walletAddress);
        } catch {
          // ignore fetch failure
        }
      }
      
      const response = await askNotary(text, { holdings, loanRisk });
      return response.answer;
    } catch {
      return "Sorry, I couldn't process that question right now. Try /status, /wallet <address>, or /cost SYMBOL AMOUNT.";
    }

  } catch {
    return "Something went wrong. Try again in a moment.";
  }
}
