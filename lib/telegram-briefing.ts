import { getAllNotaryAlerts } from './alert-engine';
import { getSubscription } from './telegram-subscribers';
import { sendTelegramMessage } from './telegram';
import { getKaminoRiskData } from './kamino-risk';

export async function buildBriefingMessage(walletAddress: string | null): Promise<string> {
  const alerts = await getAllNotaryAlerts(walletAddress ?? undefined);
  
  const today = new Date().toISOString().split('T')[0];
  let message = `*${today} Notary daily briefing*\n`;
  
  if (walletAddress === null) {
    message += `No wallet linked \u2014 send /wallet <address> to get loan and holdings alerts.\n`;
  }
  
  if (alerts.length === 0) {
    const time = new Date().toISOString().substring(11, 16) + " UTC";
    message += `\nNo new alerts today. Everything's within normal ranges as of ${time}.\n`;
  } else {
    const critical = alerts.filter(a => a.severity === 'critical');
    const warning = alerts.filter(a => a.severity === 'warning');
    const info = alerts.filter(a => a.severity === 'info');
    
    if (critical.length > 0) {
      message += `\n\ud83d\uded1 *CRITICAL*\n`;
      for (let i = 0; i < critical.length; i++) {
        const a = critical[i];
        message += `\u2022 ${a.title}: ${a.note}\n`;
      }
    }
    
    if (warning.length > 0) {
      message += `\n\u26a0\ufe0f *WARNING*\n`;
      for (let i = 0; i < warning.length; i++) {
        const a = warning[i];
        message += `\u2022 ${a.title}: ${a.note}\n`;
      }
    }
    
    if (info.length > 0) {
      message += `\n\u2139\ufe0f *INFO*\n`;
      for (let i = 0; i < info.length; i++) {
        const a = info[i];
        message += `\u2022 ${a.title}: ${a.note}\n`;
      }
    }
  }

  if (walletAddress !== null) {
    const obligations = await getKaminoRiskData(walletAddress);
    if (obligations.length > 0) {
      let loansMessage = "";
      let printedLoanSection = false;
      for (let i = 0; i < obligations.length; i++) {
        const obligation = obligations[i];
        if (typeof obligation.gapStressedHealth !== 'number') continue;
        
        if (obligation.gapStressedHealth >= 1.2) {
          if (!printedLoanSection) {
            loansMessage += `\n\ud83c\udfe6 *Loans*\n`;
            printedLoanSection = true;
          }
          const statusWord = obligation.gapStressedHealth >= 1.5 ? "healthy" : "worth watching";
          const assetName = obligation.worstAssetSymbol ?? "obligation";
          loansMessage += `\u2022 ${assetName} position: gap-stressed health ${obligation.gapStressedHealth.toFixed(2)} \u2014 ${statusWord}\n`;
        }
      }
      message += loansMessage;
    }
  }
  
  return message.trim();
}

export async function sendBriefingToChat(chatId: string): Promise<{ ok: boolean; error?: string }> {
  const sub = await getSubscription(chatId);
  if (!sub) {
    return { ok: false, error: "Not subscribed" };
  }
  
  const message = await buildBriefingMessage(sub.walletAddress);
  return await sendTelegramMessage(chatId, message);
}
